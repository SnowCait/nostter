import { accountAddressableEventCache } from '$lib/cache/Events';
import { kinds as Kind, type Event } from 'nostr-tools';
import { createRxBackwardReq, latestEach, uniq } from 'rx-nostr';
import { rxNostr, tie } from '../timelines/MainTimeline';
import { parseLegacyRelayList } from '../nostr/protocol/nip24';
import { parseRelayList } from '../nostr/protocol/nip65';
import { metadataRelays } from '$lib/Constants';

export class RelayList {
	public static async fetchEvents(pubkey: string): Promise<Map<number, Event>> {
		const kinds = [Kind.Contacts, Kind.RelayList];
		const cached = await Promise.all(
			kinds.map(
				async (kind) =>
					[kind, await accountAddressableEventCache.get(pubkey, kind)] as const
			)
		);
		const relayEventsMap = new Map<number, Event>(
			cached.filter((entry): entry is readonly [number, Event] => entry[1] !== undefined)
		);

		if (relayEventsMap.size > 0) {
			console.debug('[relay list cache]', relayEventsMap);
			return relayEventsMap;
		}

		await new Promise<void>((resolve, reject) => {
			const relaysReq = createRxBackwardReq();
			rxNostr
				.use(relaysReq, { on: { defaultWriteRelays: true, relays: metadataRelays } })
				.pipe(
					tie,
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
					kinds,
					authors: [pubkey]
				}
			]);
			relaysReq.over();
		});

		return relayEventsMap;
	}

	public static apply(eventsMap: Map<number, Event>) {
		const kind10002 = eventsMap.get(10002);
		const kind3 = eventsMap.get(3);
		const relayList = parseRelayList(kind10002?.tags ?? []);
		if (relayList.length > 0) {
			rxNostr.setDefaultRelays(relayList);
		} else if (kind3 !== undefined && kind3.content !== '') {
			rxNostr.setDefaultRelays(
				[...parseLegacyRelayList(kind3.content)].map(([url, { read, write }]) => {
					return { url, read, write };
				})
			);
		}
	}
}
