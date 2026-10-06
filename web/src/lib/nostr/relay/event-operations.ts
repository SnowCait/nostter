import type { Event, Filter } from 'nostr-tools';
import {
	createRxBackwardReq,
	createRxOneshotReq,
	latest,
	uniq,
	type EventPacket,
	type RxNostrOnParams,
	type RxNostrUseOptions
} from 'rx-nostr';
import { Observable, filter, firstValueFrom, lastValueFrom, map, toArray } from 'rxjs';
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

export async function fetchEventById(id: string, relays: string[]): Promise<Event | undefined> {
	if (relays.length === 0) {
		return undefined;
	}
	return firstValueFrom(
		requestEvents([{ ids: [id], limit: 1 }], { relays }).pipe(
			filter((event) => event.id === id)
		),
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
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));
}
