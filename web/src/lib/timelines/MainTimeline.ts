import { get, writable } from 'svelte/store';
import type * as Nostr from 'nostr-typedef';
import { ShortTextNote } from 'nostr-tools/kinds';
import * as nip10 from 'nostr-tools/nip10';
import {
	batch,
	createRxBackwardReq,
	filterByType,
	latestEach,
	uniq,
	type ConnectionState,
	type LazyFilter
} from 'rx-nostr';
import { tap, bufferTime } from 'rxjs';
import { addressRegexp, filterLimitItems, hexRegexp, timeout } from '$lib/Constants';
import { aTagContent, filterTags, parseAddress } from '$lib/EventHelper';
import { Metadata, type EventItem } from '$lib/Items';
import {
	eventItemStore,
	metadataStore,
	replaceableEventsStore,
	seenOnStore,
	storeEventItem,
	storeMetadata
} from '../cache/Events';
import { chunk, unique } from '$lib/array';
import { Content } from '$lib/Content';
import { sleep } from '$lib/Helper';
import { isReplaceableKind } from 'nostr-tools/kinds';
import { rxNostr } from '$lib/nostr/relay/client';
export { rxNostr } from '$lib/nostr/relay/client';
export { verificationClient } from '$lib/nostr/verification/client';
export { tie, seenOn, getRelayHint, getSeenOnRelays } from '$lib/nostr/relay-hints';
import { tie } from '$lib/nostr/relay-hints';
import { RelayList } from '$lib/RelayList';
import { getReadRelays, getWriteRelays, parseRelayList } from '$lib/nostr/protocol/nip65';

//#region Connection States

export const connectionStates = writable(new Map<string, ConnectionState>());

rxNostr.createConnectionStateObservable().subscribe(({ from, state }) => {
	connectionStates.update((states) => states.set(from, state));
	switch (state) {
		case 'error':
		case 'rejected':
		case 'terminated': {
			console.error('[connection]', new Date().toLocaleString(), from, state);
			break;
		}
		case 'waiting-for-retrying':
		case 'retrying':
		case 'dormant': {
			console.warn('[connection]', new Date().toLocaleString(), from, state);
			break;
		}
		case 'initialized':
		case 'connecting':
		case 'connected':
		default: {
			console.debug('[connection]', new Date().toLocaleString(), from, state);
			break;
		}
	}
});

//#endregion

const observable = rxNostr.createAllMessageObservable();
observable.pipe(filterByType('NOTICE')).subscribe((packet) => {
	console.warn('[rx-nostr notice]', packet);
});
observable.pipe(filterByType('CLOSED')).subscribe((packet) => {
	console.error('[rx-nostr closed]', packet);
});

const metadataReq = createRxBackwardReq();
const referencesReq = createRxBackwardReq();
const replaceableEventsReq = createRxBackwardReq();

export async function metadataReqEmit(pubkeys: string[]): Promise<void> {
	const groupedPubkeys = chunk(
		pubkeys.filter((pubkey) => !get(metadataStore).has(pubkey)),
		filterLimitItems
	);
	for (const pubkeys of groupedPubkeys) {
		metadataReq.emit({
			kinds: [0],
			authors: pubkeys
		});
		await sleep(0); // UI thread
	}
}

export function referencesReqEmit(event: Nostr.Event, metadataOnly: boolean = false): void {
	console.debug('[rx-nostr references REQ emit]', event);
	const content = event.kind > 0 ? event.content : (new Metadata(event).content?.about ?? '');
	metadataReqEmit(getReferencedPubkeys(event, content));

	if (metadataOnly) {
		return;
	}

	requestEventReferences(event, content);
	requestReplaceableReferences(event);
}

function getReferencedPubkeys(event: Nostr.Event, content: string): string[] {
	return unique([
		event.pubkey,
		...filterTags('p', event.tags),
		...Content.findNpubsAndNprofilesToPubkeys(content)
	]);
}

function getReferencedEventIds(event: Nostr.Event, content: string): string[] {
	return unique([
		...filterTags('e', event.tags),
		...Content.findNotesAndNeventsToIds(content),
		...event.tags
			.filter(([tagName, id]) => tagName === 'q' && id && hexRegexp.test(id))
			.map(([, id]) => id)
	]);
}

function requestEventReferences(event: Nostr.Event, content: string): void {
	const $eventItemStore = get(eventItemStore);
	const ids = getReferencedEventIds(event, content).filter((id) => !$eventItemStore.has(id));
	if (ids.length === 0) {
		return;
	}

	const relayKey = (relay: string): string => new URL(relay).href;
	const defaultReadRelays = Object.keys(rxNostr.getDefaultRelays({ filter: 'read-all' })).map(
		relayKey
	);
	const requestedRelays = new Map(ids.map((id) => [id, new Set(defaultReadRelays)]));
	referencesReq.emit({ ids });

	const requestReference = (id: string, candidateRelays: string[]): void => {
		if ($eventItemStore.has(id)) {
			return;
		}
		const requested = requestedRelays.get(id) ?? new Set<string>();
		const candidates = new Map(candidateRelays.map((relay) => [relayKey(relay), relay]));
		const relays = [...candidates]
			.filter(([key]) => !requested.has(key))
			.map(([, relay]) => relay);
		if (relays.length === 0) {
			return;
		}
		referencesReq.emit({ ids: [id] }, { relays });
		for (const relay of relays) {
			requested.add(relayKey(relay));
		}
		requestedRelays.set(id, requested);
	};

	const referenceTags = event.tags.filter(
		([tagName, id, relay]) =>
			typeof tagName === 'string' &&
			['e', 'q'].includes(tagName) &&
			typeof id === 'string' &&
			hexRegexp.test(id) &&
			typeof relay === 'string' &&
			relay.startsWith('wss://') &&
			URL.canParse(relay)
	);
	if (referenceTags.length > 0 || event.kind === ShortTextNote) {
		// If not found, try relay hints, referenced authors' write relays, and the replying author's read relays.
		setTimeout(async () => {
			for (const [, id, relay] of referenceTags) {
				requestReference(id, [relay]);
			}
			await requestNip10References(event, $eventItemStore, requestReference);
		}, timeout);
	}
}

async function requestNip10References(
	event: Nostr.Event,
	$eventItemStore: ReadonlyMap<string, EventItem>,
	requestReference: (id: string, candidateRelays: string[]) => void
): Promise<void> {
	if (event.kind !== ShortTextNote) {
		return;
	}
	const { root, reply } = nip10.parse(event);
	const references = [root, reply].filter(
		(reference): reference is NonNullable<typeof reference> =>
			reference !== undefined && !$eventItemStore.has(reference.id)
	);
	if (references.length === 0) {
		return;
	}
	const authors = unique([
		...references.flatMap((reference) => (reference.author ? [reference.author] : [])),
		event.pubkey
	]);
	const relayLists = await RelayList.fetchEvents(authors);
	const requestedIds = new Set<string>();
	for (const reference of references.toReversed()) {
		if (
			!reference.author ||
			$eventItemStore.has(reference.id) ||
			requestedIds.has(reference.id)
		) {
			continue;
		}
		requestedIds.add(reference.id);
		const relayList = relayLists.get(reference.author);
		if (relayList === undefined) {
			continue;
		}
		requestReference(
			reference.id,
			getWriteRelays(parseRelayList(relayList.tags)).filter((url) => url.startsWith('wss://'))
		);
	}
	const relayList = relayLists.get(event.pubkey);
	if (relayList !== undefined) {
		const relays = getReadRelays(parseRelayList(relayList.tags)).filter((url) =>
			url.startsWith('wss://')
		);
		const ids = unique(references.map((reference) => reference.id));
		for (const id of ids) {
			requestReference(id, relays);
		}
	}
}

function requestReplaceableReferences(event: Nostr.Event): void {
	const $replaceableEventsStore = get(replaceableEventsStore);
	const aTags = event.tags.filter(
		([tagName, address]) =>
			tagName === 'a' &&
			address !== undefined &&
			addressRegexp.test(address) &&
			!$replaceableEventsStore.has(address)
	);
	const qTags = event.tags.filter(
		([tagName, address]) =>
			tagName === 'q' &&
			address &&
			addressRegexp.test(address) &&
			!$replaceableEventsStore.has(address)
	);
	aTags.push(...qTags);
	if (aTags.length > 0) {
		const filters: LazyFilter[] = aTags.map(([, address]) => {
			const [kind, pubkey, identifier] = parseAddress(address)!;
			return isReplaceableKind(kind)
				? {
						kinds: [kind],
						authors: [pubkey]
					}
				: {
						kinds: [kind],
						authors: [pubkey],
						'#d': [identifier]
					};
		});
		replaceableEventsReq.emit(filters);
		const relays = aTags
			.map(([, , relayUrl]) => relayUrl)
			.filter(
				(relayUrl) =>
					typeof relayUrl === 'string' &&
					relayUrl.startsWith('wss://') &&
					URL.canParse(relayUrl) &&
					!Object.entries(rxNostr.getDefaultRelays()).some(([url]) => url === relayUrl)
			);
		if (relays.length > 0) {
			replaceableEventsReq.emit(filters, { relays });
		}
	}
}

rxNostr
	.use(metadataReq.pipe(bufferTime(1000, null, 10), batch()))
	.pipe(
		tie,
		uniq(),
		latestEach(({ event }) => event.pubkey)
	)
	.subscribe(({ event }) => storeMetadata(event));

rxNostr
	.use(referencesReq.pipe(bufferTime(1000, null, 10), batch()))
	.pipe(
		tie,
		uniq(),
		tap(({ event }) => referencesReqEmit(event, true))
	)
	.subscribe(({ event }) => storeEventItem(event));

rxNostr
	.use(replaceableEventsReq.pipe(bufferTime(1000, null, 10), batch()))
	.pipe(
		tie,
		uniq(),
		latestEach(({ event }) => aTagContent(event)),
		tap(({ event }) => referencesReqEmit(event, true))
	)
	.subscribe((packet) => {
		console.debug('[rx-nostr replaceable event]', packet);
		const a = aTagContent(packet.event);
		const $replaceableEventsStore = get(replaceableEventsStore);
		const cache = $replaceableEventsStore.get(a);
		if (cache === undefined || cache.created_at < packet.event.created_at) {
			$replaceableEventsStore.set(a, packet.event);
			replaceableEventsStore.set($replaceableEventsStore);
			storeSeenOn(a, packet.from);
		}
	});

// key = id | a
export function storeSeenOn(key: string, relay: string): void {
	const $seenOnStore = get(seenOnStore);
	const relays = $seenOnStore.get(key);
	if (relays === undefined) {
		$seenOnStore.set(key, new Set<string>([relay]));
	} else {
		relays.add(relay);
		$seenOnStore.set(key, relays);
	}
	seenOnStore.set($seenOnStore);
}
