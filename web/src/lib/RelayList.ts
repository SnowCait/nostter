import { Kind, type Event } from 'nostr-tools';
import { createRxBackwardReq, latestEach, uniq } from 'rx-nostr';
import { rxNostr } from './timelines/MainTimeline';
import { parseRelayJson } from './EventHelper';
import { WebStorage } from './WebStorage';

export class RelayList {
	public static async fetchEvents(pubkey: string): Promise<Map<Kind, Event>> {
		const storage = new WebStorage(localStorage);

		// Load from cache
		const relayEventsMap = new Map(
			[Kind.Contacts, Kind.RelayList]
				.map((kind) => [kind, storage.getReplaceableEvent(kind)])
				.filter((x): x is [Kind, Event] => x[1] !== undefined)
		);

		if (relayEventsMap.size > 0) {
			console.debug('[relay list cache]', relayEventsMap);
			return relayEventsMap;
		}

		await new Promise<void>((resolve, reject) => {
			const relaysReq = createRxBackwardReq();
			rxNostr
				.use(relaysReq)
				.pipe(
					uniq(),
					latestEach(({ event }) => event.kind)
				)
				.subscribe({
					next: (packet) => {
						console.debug('[relay list next]', packet);
						relayEventsMap.set(packet.event.kind, packet.event);
					},
					complete: () => {
						console.debug('[relay list complete]');
						resolve();
					},
					error: (error) => {
						console.error('[relay list error]', error);
						reject();
					}
				});
			relaysReq.emit([
				{
					kinds: [Kind.Contacts, Kind.RelayList],
					authors: [pubkey]
				}
			]);
			relaysReq.over();
		});

		return relayEventsMap;
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
		}
	}
}
