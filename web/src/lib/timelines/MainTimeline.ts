import { get, writable } from 'svelte/store';
import type { Event, EventParameters } from 'nostr-typedef';
import {
	Nip11Registry,
	batch,
	createRxBackwardReq,
	createRxNostr,
	filterByType,
	latestEach,
	now,
	uniq,
	type ConnectionState,
	type LazyFilter
} from 'rx-nostr';
import { createNoopClient, createVerificationServiceClient } from 'rx-nostr-crypto';
import { tap, bufferTime } from 'rxjs';
import { browser } from '$app/environment';
import { addressRegexp, filterLimitItems, hexRegexp, timeout } from '$lib/Constants';
import { aTagContent, filterTags } from '$lib/EventHelper';
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
import workerUrl from '$lib/Worker?worker&url';
import { Signer } from '$lib/Signer';
import { createTie } from '$lib/RxNostrTie';
import { isReplaceableKind } from 'nostr-tools/kinds';

Nip11Registry.setDefault({
	limitation: {
		max_subscriptions: 20
	}
});

export const verificationClient = browser
	? createVerificationServiceClient({
			worker: new Worker(workerUrl, { type: 'module' }),
			timeout: 600000
		})
	: createNoopClient();
verificationClient.start();

export const rxNostr = createRxNostr({
	verifier: verificationClient.verifier,
	connectionStrategy: 'lazy-keep',
	eoseTimeout: timeout,
	okTimeout: timeout,
	retry: { strategy: 'exponential', maxCount: 5, initialDelay: 1000, polite: true },
	authenticator: 'auto',
	signer: {
		getPublicKey: () => Signer.getPublicKey(),
		signEvent: async <K extends number>(params: EventParameters<K>): Promise<Event<K>> => {
			if (params.sig) {
				return params as Event<K>;
			}

			const event = await Signer.signEvent({
				...params,
				tags: params.tags ?? [],
				created_at: params.created_at ?? now()
			});
			return event as Event<K>;
		}
	}
}); // Based on NIP-65

//#region Relay hints

export const [tie, seenOn] = createTie();

export function getRelayHint(id: string): string | undefined {
	return seenOn
		.get(id)
		?.values()
		.filter((value) => value.startsWith('wss://'))
		.next().value;
}

export function getSeenOnRelays(id: string): string[] | undefined {
	const relays = seenOn.get(id);
	if (relays === undefined) {
		return undefined;
	}
	return [...relays].filter((value) => value.startsWith('wss://'));
}

//#endregion

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

const recconectableStates: ConnectionState[] = [
	'error',
	'rejected',
	'terminated',
	'waiting-for-retrying',
	'retrying',
	'dormant'
];

export function reconnectIfConnectionsAreUnstable(): void {
	const states: [string, ConnectionState][] = Object.entries(rxNostr.getAllRelayStatus()).map(
		([relay, status]) => [relay, status.connection]
	);
	console.log('[relay states]', states);
	if (
		states.filter(([, state]) => recconectableStates.includes(state)).length * 2 <
		states.length
	) {
		return;
	}

	// TODO: Clear timeline and reconnect WebSocket without reload
	console.log('[reload]', states);
	location.reload();
}

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
		console.debug('[rx-nostr metadata REQ emit]', pubkeys);
		metadataReq.emit({
			kinds: [0],
			authors: pubkeys
		});
		await sleep(0); // UI thread
	}
}

export function referencesReqEmit(event: Event, metadataOnly: boolean = false): void {
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
		if (referenceTags.length > 0) {
			// If not found, look up from the relay hint
			setTimeout(() => {
				const undiscoveredReferenceTags = referenceTags.filter(
					([, id]) => !$eventItemStore.has(id)
				);
				if (undiscoveredReferenceTags.length === 0) {
					return;
				}
				referencesReq.emit(
					{ ids: undiscoveredReferenceTags.map(([, id]) => id) },
					{ relays: undiscoveredReferenceTags.map(([, , relay]) => relay) }
				);
			}, timeout);
		}
	}

	const $replaceableEventsStore = get(replaceableEventsStore);
	const aTags = event.tags.filter(
		([tagName, address]) =>
			tagName === 'a' && address !== undefined && !$replaceableEventsStore.has(address)
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
		const filters: LazyFilter[] = aTags.map(([, a]) => {
			const [kind, pubkey, identifier] = a.split(':');
			return isReplaceableKind(Number(kind))
				? {
						kinds: [Number(kind)],
						authors: [pubkey]
					}
				: {
						kinds: [Number(kind)],
						authors: [pubkey],
						'#d': [identifier]
					};
		});
		replaceableEventsReq.emit(filters);
		const relays = aTags
			.map(([, , relayUrl]) => relayUrl)
			.filter(
				(relayUrl) =>
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
