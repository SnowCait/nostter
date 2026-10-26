import type { Event, Filter } from 'nostr-tools';
import { sortEvents } from 'nostr-tools/core';
import {
	createRxBackwardReq,
	createRxOneshotReq,
	latest,
	uniq,
	type EventPacket,
	type LazyFilter,
	type RxNostrOnParams,
	type RxNostrUseOptions
} from 'rx-nostr';
import { Observable, filter, firstValueFrom, lastValueFrom, map, tap, toArray } from 'rxjs';
import { rxNostr } from '$lib/relay-client';
import { tie } from './relay-hints';

export async function fetchEvents(filters: LazyFilter[], on?: RxNostrOnParams): Promise<Event[]> {
	const req = createRxOneshotReq({ filters });
	return lastValueFrom(
		rxNostr.use(req, { on }).pipe(
			tie,
			uniq(),
			map(({ event }) => event),
			toArray(),
			map(sortEvents)
		)
	);
}

export function requestEvents(filters: Filter[], on?: RxNostrOnParams): Observable<Event> {
	return requestEventPackets(filters, { on }).pipe(map(({ event }) => event));
}

export function requestLatestReplaceableEvent(kind: number, pubkey: string): Observable<Event> {
	return requestEventPackets([{ kinds: [kind], authors: [pubkey], limit: 1 }]).pipe(
		latest(),
		map(({ event }) => event)
	);
}

export async function fetchLatestReplaceableEvent(
	kind: number,
	pubkey: string
): Promise<Event | undefined> {
	return lastValueFrom(requestLatestReplaceableEvent(kind, pubkey), { defaultValue: undefined });
}

export async function fetchEventById(id: string, on?: RxNostrOnParams): Promise<Event | undefined> {
	return firstValueFrom(
		requestEvents([{ ids: [id], limit: 1 }], on).pipe(filter((event) => event.id === id)),
		{ defaultValue: undefined }
	);
}

function requestEventPackets(
	filters: Filter[],
	options?: Partial<RxNostrUseOptions>
): Observable<EventPacket> {
	return new Observable((subscriber) => {
		const req = createRxBackwardReq();
		const subscription = rxNostr.use(req, options).pipe(tie, uniq()).subscribe(subscriber);
		req.emit(filters);
		req.over();
		return subscription;
	});
}

export async function publishEvent(event: Event): Promise<void> {
	await firstValueFrom(
		rxNostr.send(event).pipe(
			tap(({ from, notice, ok }) => {
				if (!ok) {
					console.debug('[relay rejected event]', from, notice);
				}
			}),
			filter(({ ok }) => ok)
		)
	);
}
