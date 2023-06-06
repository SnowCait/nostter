import { get } from 'svelte/store';
import { Kind, type Event, SimplePool } from 'nostr-tools';
import { Api } from './Api';
import { defaultRelays } from '../stores/DefaultRelays';

export class RelaysFetcher {
	public static async fetchEvents(
		pubkey: string,
		relays: string[] = []
	): Promise<Map<Kind, Event>> {
		const pool = new SimplePool();
		const $defaultRelays = get(defaultRelays);
		const api = new Api(pool, Array.from(new Set([...relays, ...$defaultRelays])));

		const saveCache = (events: Map<Kind, Event>, cachedEvents: Map<Kind, Event>): void => {
			// Save cache
			for (const [kind, event] of events) {
				const cache = cachedEvents.get(kind);
				if (cache !== undefined && cache.created_at >= event.created_at) {
					continue;
				}
				localStorage.setItem(`nostter:kind:${kind}`, JSON.stringify(event));
			}
		};

		// Load cache
		const cachedEvents = new Map(
			[Kind.RecommendRelay, Kind.Contacts, Kind.RelayList]
				.map((kind) => {
					const event = localStorage.getItem(`nostter:kind:${kind}`);
					if (event === null) {
						return null;
					}
					try {
						return [kind, JSON.parse(event) as Event];
					} catch (error) {
						return null;
					}
				})
				.filter((x): x is [Kind, Event] => x !== null)
		);
		if (cachedEvents.size > 0) {
			api.fetchRelayEvents(pubkey).then((events) => {
				api.close();
				saveCache(events, cachedEvents);
			});
			return cachedEvents;
		}

		const events = await api.fetchRelayEvents(pubkey);

		api.close();
		saveCache(events, cachedEvents);

		return events;
	}
}
