import { referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
import type { Event } from 'nostr-typedef';
import { createRxBackwardReq, latest, type LazyFilter, uniq } from 'rx-nostr';
import { tap } from 'rxjs';
import { reverseChronological } from '$lib/Constants';

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

export async function fetchEvents(filters: LazyFilter[]): Promise<Event[]> {
	const { promise, resolve } = Promise.withResolvers<Event[]>();
	const events: Event[] = [];
	const req = createRxBackwardReq();
	rxNostr
		.use(req)
		.pipe(
			uniq(),
			tap(({ event }) => referencesReqEmit(event))
		)
		.subscribe({
			next: ({ from, event }) => {
				console.debug('[rx-nostr fetch next]', from, event);
				events.push(event);
			},
			complete: () => {
				console.debug('[rx-nostr fetch complete]', events.length);
				resolve(events.toSorted(reverseChronological));
			},
			error: (error) => {
				console.warn('[rx-nostr fetch error]', error);
				resolve(events);
			}
		});
	req.emit(filters);
	req.over();
	return await promise;
}
