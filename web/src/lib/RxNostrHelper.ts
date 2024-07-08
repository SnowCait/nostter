import { rxNostr } from '$lib/timelines/MainTimeline';
import type { Event } from 'nostr-typedef';
import { createRxBackwardReq, latest, type LazyFilter } from 'rx-nostr';

export async function fetchLastEvent(filter: LazyFilter): Promise<Event | undefined> {
	return await new Promise((resolve) => {
		let lastEvent: Event | undefined;
		const req = createRxBackwardReq();
		rxNostr
			.use(req)
			.pipe(latest())
			.subscribe({
				next: ({ from, event }) => {
					console.debug('[rx-nostr last next]', from, event);
					lastEvent = event;
				},
				complete: () => {
					console.debug('[rx-nostr last complete]', lastEvent);
					resolve(lastEvent);
				},
				error: (error) => {
					console.warn('[rx-nostr last error]', error);
					resolve(lastEvent);
				}
			});
		req.emit([filter]);
		req.over();
	});
}
