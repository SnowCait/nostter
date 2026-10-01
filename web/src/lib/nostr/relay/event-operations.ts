import type { Event, Filter } from 'nostr-tools';
import {
	createRxBackwardReq,
	createRxOneshotReq,
	latest,
	uniq,
	type RxNostrOnParams
} from 'rx-nostr';
import { EmptyError, Observable, filter, firstValueFrom, lastValueFrom, map, toArray } from 'rxjs';
import { rxNostr } from '$lib/relay-client';
import { tie } from './relay-hints';

export async function fetchEvents(filters: Filter[]): Promise<Event[]> {
	const req = createRxOneshotReq({ filters });
	return lastValueFrom(
		rxNostr.use(req).pipe(
			tie,
			uniq(),
			map(({ event }) => event),
			toArray()
		)
	);
}

export function requestEvents(filters: Filter[], on: RxNostrOnParams): Observable<Event> {
	return new Observable((subscriber) => {
		const req = createRxBackwardReq();
		const subscription = rxNostr
			.use(req, { on })
			.pipe(
				tie,
				uniq(),
				map(({ event }) => event)
			)
			.subscribe(subscriber);
		req.emit(filters);
		req.over();
		return subscription;
	});
}

export async function fetchLatestReplaceableEvent(
	kind: number,
	pubkey: string
): Promise<Event | undefined> {
	const req = createRxOneshotReq({ filters: [{ kinds: [kind], authors: [pubkey], limit: 1 }] });
	try {
		const { event } = await lastValueFrom(rxNostr.use(req).pipe(tie, latest()));
		return event;
	} catch (error) {
		if (error instanceof EmptyError) {
			return undefined;
		}
		throw error;
	}
}

export async function publishEvent(event: Event): Promise<void> {
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));
}
