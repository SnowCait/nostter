import { createRxOneshotReq, latest } from 'rx-nostr';
import { lastValueFrom } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { rxNostr } from './timelines/MainTimeline';
import { filterTags, findIdentifier } from './EventHelper';

export async function fetchListEvent(
	kind: number,
	pubkey: string,
	identifier: string
): Promise<Event | undefined> {
	try {
		const req = createRxOneshotReq({
			filters: [{ kinds: [kind], authors: [pubkey], '#d': [identifier] }]
		});
		const { event } = await lastValueFrom(rxNostr.use(req).pipe(latest()));
		return event;
	} catch (error) {
		console.warn('[list event not found]', error);
		return undefined;
	}
}

export function getListTitle(tags: string[][]): string {
	return filterTags('title', tags).at(0)?.at(1) ?? findIdentifier(tags) ?? '-';
}
