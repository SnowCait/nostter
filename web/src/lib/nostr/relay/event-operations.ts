import type { Event } from 'nostr-tools';
import { createRxOneshotReq, latest } from 'rx-nostr';
import { EmptyError, filter, firstValueFrom, lastValueFrom } from 'rxjs';
import { rxNostr } from '$lib/relay-client';
import { tie } from './relay-hints';

export async function fetchLatestReplaceableEvent(
	kind: number,
	pubkey: string
): Promise<Event | undefined> {
	const req = createRxOneshotReq({ filters: [{ kinds: [kind], authors: [pubkey], limit: 1 }] });
	try {
		const { event } = await lastValueFrom(rxNostr.use(req).pipe(tie, latest()));
		return event;
	} catch (error) {
		if (error instanceof EmptyError) return undefined;
		throw error;
	}
}

export async function publishEvent(event: Event): Promise<void> {
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));
}
