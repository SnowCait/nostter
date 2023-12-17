import { Kind, type Event, SimplePool } from 'nostr-tools';
import { Api } from './Api';
import { defaultRelays } from './Constants';
import { rxNostr } from './timelines/MainTimeline';
import { parseRelayJson } from './EventHelper';
import { WebStorage } from './WebStorage';

export class RelayList {
	public static async fetchEvents(
		pubkey: string,
		relays: string[] = []
	): Promise<Map<Kind, Event>> {
		const pool = new SimplePool();
		const api = new Api(pool, Array.from(new Set([...relays, ...defaultRelays])));

		const storage = new WebStorage(localStorage);

		const saveCache = (events: Map<Kind, Event>): void => {
			// Save cache
			for (const [, event] of events) {
				storage.setReplaceableEvent(event);
			}
		};

		// Load cache
		const cachedEvents = new Map(
			[Kind.Contacts, Kind.RelayList]
				.map((kind) => [kind, storage.getReplaceableEvent(kind)])
				.filter((x): x is [Kind, Event] => x[1] !== null)
		);
		if (cachedEvents.size > 0) {
			api.fetchRelayEvents(pubkey).then((events) => {
				api.close();
				saveCache(events);
			});
			return cachedEvents;
		}

		const events = await api.fetchRelayEvents(pubkey);

		api.close();
		saveCache(events);

		return events;
	}

	public static apply(eventsMap: Map<Kind, Event>) {
		const kind10002 = eventsMap.get(10002);
		const kind3 = eventsMap.get(3);
		if (kind10002 !== undefined) {
			rxNostr.setDefaultRelays(kind10002.tags);
		} else if (kind3 !== undefined && kind3.content !== '') {
			rxNostr.setDefaultRelays(
				[...parseRelayJson(kind3.content)].map(([url, { read, write }]) => {
					return { url, read, write };
				})
			);
		} else {
			rxNostr.setDefaultRelays(defaultRelays);
		}
	}
}
