import { referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
import type { Event } from 'nostr-typedef';
import {
	createRxBackwardReq,
	latest,
	type LazyFilter,
	now,
	type RxNostrOnParams,
	uniq
} from 'rx-nostr';
import { filter, firstValueFrom, tap } from 'rxjs';
import { reverseChronological } from '$lib/Constants';
import { Signer } from './Signer';

export async function fetchFirstEvent(filter: LazyFilter): Promise<Event | undefined> {
	try {
		const req = createRxBackwardReq();
		const promise = firstValueFrom(rxNostr.use(req).pipe(uniq()));
		req.emit([filter]);
		req.over();
		const { event } = await promise;
		return event;
	} catch (error) {
		console.debug('[event not found]', filter, error);
		return undefined;
	}
}

export async function fetchLastEvent(
	filter: LazyFilter,
	on?: RxNostrOnParams | undefined
): Promise<Event | undefined> {
	return await new Promise((resolve) => {
		let lastEvent: Event | undefined;
		const req = createRxBackwardReq();
		rxNostr
			.use(req, { on })
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

export async function fetchEvents(
	filters: LazyFilter[],
	relays: string[] | undefined = undefined
): Promise<Event[]> {
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
	if (relays !== undefined && relays.length > 0) {
		req.emit(filters, { relays });
	} else {
		req.emit(filters);
	}
	req.over();
	return await promise;
}

export async function sendEvent(kind: number, content: string, tags: string[][]): Promise<Event> {
	const { promise, resolve, reject } = Promise.withResolvers<void>();
	const event = await Signer.signEvent({ kind, content, tags, created_at: now() });
	rxNostr
		.send(event)
		.pipe(filter(({ ok }) => ok))
		.subscribe({ next: () => resolve(), complete: () => reject() });
	await promise;
	return event;
}
