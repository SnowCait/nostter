import { get } from 'svelte/store';
import { createRxOneshotReq, latest } from 'rx-nostr';
import { lastValueFrom } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { rxNostr } from './timelines/MainTimeline';
import { filterTags, findIdentifier } from './EventHelper';
import { parsePrivateTags } from './Encryption';
import { pubkey } from '../stores/Author';

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

export async function getListPubkeys(event: Event): Promise<string[]> {
	const tags = event.tags;

	const $pubkey = get(pubkey);
	if (event.pubkey === $pubkey) {
		const privateTags = await parsePrivateTags(event.pubkey, event.content);
		tags.push(...privateTags);
	}

	const pubkeys = filterTags('p', tags);
	return [...new Set(pubkeys)];
}
