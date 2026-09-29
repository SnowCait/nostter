import type { Event } from 'nostr-tools';
import { RelayList } from './author/RelayList';
import { findIdentifier } from './nostr/protocol/event-address';
import { shouldReplaceCurrentEvent } from './nostr/protocol/replaceable-event';
import { fetchEvents } from './nostr/relay/event-operations';
import { accountAddressableEventCache, cacheAccountEvent } from './cache/Events';
import {
	authorReplaceableKinds,
	parameterizedReplaceableKinds,
	replaceableKinds
} from './Constants';

export type LoadedAccountEvents = {
	replaceableEvents: Map<number, Event>;
	parameterizedReplaceableEvents: Map<string, Event>;
};

export class Author {
	constructor(private pubkey: string) {}

	public async fetchRelays() {
		const relayEvents = await RelayList.fetchEvents(this.pubkey);
		console.log('[relay events]', relayEvents);

		RelayList.apply(relayEvents);
	}

	public fetchEvents(): Promise<LoadedAccountEvents> {
		return this.fetchAuthorEventsWithCache(this.pubkey);
	}

	private async fetchAuthorEventsWithCache(pubkey: string): Promise<LoadedAccountEvents> {
		const cached = await Promise.all(
			authorReplaceableKinds.map(async ({ kind, identifier }) => ({
				kind,
				identifier,
				event: await accountAddressableEventCache.get(pubkey, kind, identifier ?? '')
			}))
		);
		const replaceableEvents = new Map<number, Event>();
		const parameterizedReplaceableEvents = new Map<string, Event>();
		for (const { kind, identifier, event } of cached) {
			if (event === undefined) {
				continue;
			}
			if (identifier === undefined) {
				replaceableEvents.set(kind, event);
			} else {
				parameterizedReplaceableEvents.set(`${kind}:${identifier}`, event);
			}
		}
		if (replaceableEvents.size + parameterizedReplaceableEvents.size > 0) {
			return { replaceableEvents, parameterizedReplaceableEvents };
		}

		const fetched = await this.fetchAuthorEvents(pubkey);
		for (const event of [
			...fetched.replaceableEvents.values(),
			...fetched.parameterizedReplaceableEvents.values()
		]) {
			await cacheAccountEvent(event);
		}
		return fetched;
	}

	private async fetchAuthorEvents(pubkey: string) {
		const events = await fetchEvents([
			{
				kinds: [...replaceableKinds, ...parameterizedReplaceableKinds],
				authors: [pubkey]
			}
		]);
		const latestEvents = new Map<string, Event>();
		const replaceableEvents = new Map<number, Event>();
		const parameterizedReplaceableEvents = new Map<string, Event>();
		for (const event of events) {
			const key = `${event.kind}:${findIdentifier(event.tags) ?? ''}`;
			if (!shouldReplaceCurrentEvent(event, latestEvents.get(key))) {
				continue;
			}
			latestEvents.set(key, event);
			if (replaceableKinds.includes(event.kind)) {
				replaceableEvents.set(event.kind, event);
			} else if (parameterizedReplaceableKinds.includes(event.kind)) {
				parameterizedReplaceableEvents.set(key, event);
			} else {
				console.error('[author logic error]', event);
			}
		}
		return { replaceableEvents, parameterizedReplaceableEvents };
	}
}
