import { createRxBackwardReq, latestEach, uniq } from 'rx-nostr';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import type { pubkey } from './Types';
import { rxNostr, tie } from './timelines/MainTimeline';
import { cacheFolloweeReplaceableEvent, followeeEventCache } from './cache/Events';

export class RelayList {
	static async fetchEvents(pubkeys: pubkey[]): Promise<Map<pubkey, Nostr.Event>> {
		if (pubkeys.length === 0) {
			return new Map();
		}

		const eventsMap = await followeeEventCache.getLatest(Kind.RelayList, pubkeys);

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
					next: ({ event }) => {
						const current = eventsMap.get(event.pubkey);
						if (current === undefined || current.created_at < event.created_at) {
							eventsMap.set(event.pubkey, event);
						}
						cacheFolloweeReplaceableEvent(event);
					},
					complete: () => {
						resolve(eventsMap);
					},
					error: (error) => {
						console.error('[rx-nostr kind 10002 error]', pubkeys, error);
						resolve(eventsMap);
					}
				});
			req.emit([{ kinds: [Kind.RelayList], authors: pubkeys }]);
			req.over();
		});
	}
}
