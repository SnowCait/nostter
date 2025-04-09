import { get } from 'svelte/store';
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
import { filterLimitItems, timeout } from '$lib/Constants';
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
	authenticator: {
		signer: {
			getPublicKey: () => Signer.getPublicKey(),
			signEvent: async <K extends number>(
				unsignedEvent: EventParameters<K>
			): Promise<Event<K>> => {
				console.debug('[AUTH]', unsignedEvent);
				const event = await Signer.signEvent({
					...unsignedEvent,
					tags: unsignedEvent.tags ?? [],
					created_at: unsignedEvent.created_at ?? now()
				});
				return {
					...event,
					ots: unsignedEvent.ots
				} as Event<K>;
			}
		}
	}
}); // Based on NIP-65

rxNostr.createConnectionStateObservable().subscribe(({ from, state }) => {
	switch (state) {
		case 'error':
		case 'rejected':
		case 'terminated': {
			console.error('[rx-nostr connection]', from, state);
			break;
		}
		case 'waiting-for-retrying':
		case 'retrying':
		case 'dormant': {
			console.warn('[rx-nostr connection]', from, state);
			break;
		}
		case 'initialized':
		case 'connecting':
		case 'connected':
		default: {
			console.log('[rx-nostr connection]', from, state);
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

const observable = rxNostr.createAllMessageObservable();
observable.pipe(filterByType('NOTICE')).subscribe((packet) => {
	console.warn('[rx-nostr notice]', packet);
});
observable.pipe(filterByType('CLOSED')).subscribe((packet) => {
	console.error('[rx-nostr closed]', packet);
});

const metadataReq = createRxBackwardReq();
const eventsReq = createRxBackwardReq();
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
		...new Set([...filterTags('e', event.tags), ...Content.findNotesAndNeventsToIds(content)])
	].filter((id) => !$eventItemStore.has(id));

	if (ids.length > 0) {
		eventsReq.emit({
			ids
		});
	}

	const $replaceableEventsStore = get(replaceableEventsStore);
	const aTags = event.tags.filter(
		([tagName, a]) => tagName === 'a' && a !== undefined && !$replaceableEventsStore.has(a)
	);
	if (aTags.length > 0) {
		const filters: LazyFilter[] = aTags.map(([, a]) => {
			const [kind, pubkey, identifier] = a.split(':');
			return {
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
		uniq(),
		latestEach(({ event }) => event.pubkey)
	)
	.subscribe(({ event }) => storeMetadata(event));

rxNostr
	.use(eventsReq.pipe(bufferTime(1000, null, 10), batch()))
	.pipe(
		uniq(),
		tap(({ event }) => referencesReqEmit(event, true))
	)
	.subscribe(({ event }) => storeEventItem(event));

rxNostr
	.use(replaceableEventsReq.pipe(bufferTime(1000, null, 10), batch()))
	.pipe(
		uniq(),
		latestEach(({ event }) => aTagContent(event))
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
