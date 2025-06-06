import { createRxBackwardReq, latestEach, uniq } from 'rx-nostr';
import type { Event } from 'nostr-typedef';
import type { pubkey } from './Types';
import { rxNostr, tie } from './timelines/MainTimeline';

export class RelayList {
	static async fetchEvents(pubkeys: pubkey[]): Promise<Map<pubkey, Event>> {
		const eventsMap = new Map<pubkey, Event>();
		if (pubkeys.length === 0) {
			return eventsMap;
		}

		return new Promise((resolve) => {
			const req = createRxBackwardReq();
			rxNostr
				.use(req)
				.pipe(
					tie,
					uniq(),
					latestEach(({ event }) => event.pubkey)
				)
				.subscribe({
					next: (packet) => {
						console.debug('[rx-nostr kind 10002 next]', pubkeys, packet);
						eventsMap.set(packet.event.pubkey, packet.event);
					},
					complete: () => {
						console.debug('[rx-nostr kind 10002 complete]', pubkeys);
						resolve(eventsMap);
					},
					error: (error) => {
						console.error('[rx-nostr kind 10002 error]', pubkeys, error);
						resolve(eventsMap);
					}
				});
			req.emit([{ kinds: [10002], authors: pubkeys }]);
			req.over();
		});
	}
}
