import { get, writable } from 'svelte/store';
import type * as Nostr from 'nostr-typedef';
import { kinds as Kind } from 'nostr-tools';
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
import { Metadata } from '$lib/Items';
import {
	eventItemStore,
	metadataStore,
	replaceableEventsStore,
	seenOnStore,
	storeEventItem,
	storeMetadata
} from '../cache/Events';
import { chunk } from '$lib/Array';
import { Content } from '$lib/Content';
import { sleep } from '$lib/Helper';
import { isReplaceableKind } from 'nostr-tools/kinds';
import { rxNostr } from '$lib/nostr/client';
export { rxNostr, verificationClient } from '$lib/nostr/client';
export { tie, seenOn, getRelayHint, getSeenOnRelays } from '$lib/nostr/relay-hints';
import { tie } from '$lib/nostr/relay-hints';
import { RelayList } from '$lib/RelayList';
import { getWriteRelays, parseRelayList } from '$lib/nostr/nip65';

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
	metadataReqEmit([
		...new Set([
			event.pubkey,
			...filterTags('p', event.tags),
			...Content.findNpubsAndNprofilesToPubkeys(content)
		])
	]);

	if (metadataOnly) {
		return;
	}

	const $eventItemStore = get(eventItemStore);
	const ids = [
		...new Set([
			...filterTags('e', event.tags),
			...Content.findNotesAndNeventsToIds(content),
			...event.tags
				.filter(([tagName, id]) => tagName === 'q' && id && hexRegexp.test(id))
				.map(([, id]) => id)
		])
	].filter((id) => !$eventItemStore.has(id));

	if (ids.length > 0) {
		referencesReq.emit({ ids });

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
		if (referenceTags.length > 0 || event.kind === Kind.ShortTextNote) {
			// If not found, look up from the relay hint
			setTimeout(async () => {
				const undiscoveredReferenceTags = referenceTags.filter(
					([, id]) => !get(eventItemStore).has(id)
				);
				if (undiscoveredReferenceTags.length > 0) {
					referencesReq.emit(
						{ ids: undiscoveredReferenceTags.map(([, id]) => id) },
						{ relays: undiscoveredReferenceTags.map(([, , relay]) => relay) }
					);
				}
				if (event.kind !== Kind.ShortTextNote) {
					return;
				}
				const { root, reply } = nip10.parse(event);
				const references = new Map<string, string>();
				for (const reference of [root, reply]) {
					if (reference?.author && !get(eventItemStore).has(reference.id)) {
						references.set(reference.id, reference.author);
					}
				}
				if (references.size === 0) {
					return;
				}
				const relayLists = await RelayList.fetchEvents([...new Set(references.values())]);
				for (const [id, author] of references) {
					if (get(eventItemStore).has(id)) {
						continue;
					}
					const relayList = relayLists.get(author);
					if (relayList === undefined) {
						continue;
					}
					const relays = [...new Set(getWriteRelays(parseRelayList(relayList.tags)))];
					if (relays.length > 0) {
						referencesReq.emit({ ids: [id] }, { relays });
					}
				}
			}, timeout);
		}
	}

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
