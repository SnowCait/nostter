import { get } from 'svelte/store';
import { createRxOneshotReq, latest } from 'rx-nostr';
import { lastValueFrom } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { rxNostr, tie } from './timelines/MainTimeline';
import { filterTags, findIdentifier, getTitle } from './EventHelper';
import { parsePrivateTags } from './Encryption';
import { pubkey } from './stores/Author';
import { Signer } from './Signer';

export async function fetchListEvent(
	kind: number,
	pubkey: string,
	identifier: string
): Promise<Event | undefined> {
	try {
		const req = createRxOneshotReq({
			filters: [{ kinds: [kind], authors: [pubkey], '#d': [identifier] }]
		});
		const { event } = await lastValueFrom(rxNostr.use(req).pipe(tie, latest()));
		return event;
	} catch (error) {
		console.warn('[list event not found]', error);
		return undefined;
	}
}

export function getListTitle(tags: string[][]): string {
	return getTitle(tags) ?? findIdentifier(tags) ?? '-';
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

export async function decryptListContent(content: string): Promise<string[][]> {
	if (content === '') {
		return [];
	}

	const $pubkey = get(pubkey);

	try {
		const json = await Signer.decrypt($pubkey, content);
		return JSON.parse(json);
	} catch (error) {
		console.warn('[list parse error]', error);
		return [];
	}
}

export async function encryptListContent(tags: string[][]): Promise<string> {
	if (tags.length === 0) {
		return '';
	}

	const $pubkey = get(pubkey);
	return Signer.encrypt($pubkey, JSON.stringify(tags));
}
