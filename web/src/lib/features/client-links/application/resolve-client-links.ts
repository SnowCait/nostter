import type { Event } from 'nostr-tools';
import * as nip19 from 'nostr-tools/nip19';
import { get } from 'svelte/store';
import { EMPTY, catchError, concat, defer, ignoreElements, of, tap, type Observable } from 'rxjs';
import { replaceableEventsStore } from '$lib/cache/Events';
import { getEventAddress } from '$lib/nostr/protocol/event-address';
import {
	createHandlerInformationFilter,
	parseClientTags,
	resolveHandlerLink,
	type ClientTag
} from '$lib/nostr/protocol/nip89';
import { shouldReplaceCurrentEvent } from '$lib/nostr/protocol/replaceable-event';
import { requestEvents } from '$lib/nostr/relay/event-operations';
import { getSeenOnRelays } from '$lib/nostr/relay/relay-hints';

/** Links keyed by the handler address of client tags. */
export type ClientLinks = ReadonlyMap<string, URL>;

type ClientHandler = NonNullable<ClientTag['handler']>;

type TargetEvent = Pick<Event, 'id' | 'pubkey' | 'kind' | 'tags'>;

export function collectClientHandlers(clients: ClientTag[]): {
	handlers: ClientHandler[];
	relays: string[];
} {
	const handlers = new Map<string, ClientHandler>();
	const relays = new Set<string>();
	for (const { handler } of clients) {
		if (handler === undefined) {
			continue;
		}
		if (!handlers.has(handler.address)) {
			handlers.set(handler.address, handler);
		}
		if (handler.relay !== undefined) {
			relays.add(handler.relay);
		}
	}
	return { handlers: [...handlers.values()], relays: [...relays] };
}

export function resolveClientLinks(event: TargetEvent): Observable<ClientLinks> {
	const { handlers, relays } = collectClientHandlers(parseClientTags(event.tags));
	if (handlers.length === 0) {
		return EMPTY;
	}

	const cachedLinks = defer(() => of(resolveFromCache(event, handlers)));
	const cache = get(replaceableEventsStore);
	const missingHandlers = handlers.filter(({ address }) => !cache.has(address));
	if (missingHandlers.length === 0) {
		return cachedLinks;
	}

	const missingAddresses = new Set(missingHandlers.map(({ address }) => address));
	const fetchHandlers = requestEvents(
		missingHandlers.map(({ pointer }) => createHandlerInformationFilter(pointer)),
		{ relays, defaultReadRelays: true }
	).pipe(
		tap((handler) => {
			if (missingAddresses.has(getEventAddress(handler))) {
				storeHandlerInformation(handler);
			}
		}),
		ignoreElements(),
		catchError((error) => {
			console.warn('[client handler fetch error]', error);
			return EMPTY;
		})
	);
	return concat(cachedLinks, fetchHandlers, cachedLinks);
}

function storeHandlerInformation(handler: Event): void {
	const address = getEventAddress(handler);
	const $replaceableEventsStore = get(replaceableEventsStore);
	if (shouldReplaceCurrentEvent(handler, $replaceableEventsStore.get(address))) {
		$replaceableEventsStore.set(address, handler);
		replaceableEventsStore.set($replaceableEventsStore);
	}
}

function resolveFromCache(event: TargetEvent, handlers: ClientHandler[]): ClientLinks {
	const nevent = nip19.neventEncode({
		id: event.id,
		author: event.pubkey,
		kind: event.kind,
		relays: getSeenOnRelays(event.id)
	});
	const cache = get(replaceableEventsStore);
	const links = new Map<string, URL>();
	for (const { address } of handlers) {
		const handler = cache.get(address);
		const link = handler === undefined ? undefined : resolveHandlerLink(handler, nevent);
		if (link !== undefined) {
			links.set(address, link);
		}
	}
	return links;
}
