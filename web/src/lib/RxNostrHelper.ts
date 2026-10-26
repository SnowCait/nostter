import { rxNostr, tie } from '$lib/timelines/MainTimeline';
import type * as Nostr from 'nostr-typedef';
import { createRxBackwardReq, latest, type LazyFilter, type RxNostrOnParams } from 'rx-nostr';

export async function fetchLastEvent(
	filter: LazyFilter,
	on?: RxNostrOnParams | undefined
): Promise<Nostr.Event | undefined> {
	return await new Promise((resolve) => {
		let lastEvent: Nostr.Event | undefined;
		const req = createRxBackwardReq();
		rxNostr
			.use(req, { on })
			.pipe(tie, latest())
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
