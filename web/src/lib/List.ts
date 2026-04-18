import { get } from 'svelte/store';
import { createRxOneshotReq, latest } from 'rx-nostr';
import { lastValueFrom } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { rxNostr, tie } from './timelines/MainTimeline';
import { filterTags, findIdentifier, getTitle, isLegacyEncryption } from './EventHelper';
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
		const [privateTags] = await decryptListContent(event.pubkey, event.content);
		tags.push(...privateTags);
	}

	const pubkeys = filterTags('p', tags);
	return [...new Set(pubkeys)];
}

export async function decryptListContent(
	pubkey: string,
	content: string
): Promise<[tags: string[][], legacy: boolean]> {
	if (content === '') {
		return [[], false];
	}

	try {
		const legacy = isLegacyEncryption(content);
		const json = await (legacy
			? Signer.decrypt(pubkey, content)
			: Signer.decryptNip44(pubkey, content));
		return [JSON.parse(json), legacy];
	} catch (error) {
		console.warn('[list parse error]', error);
		return [[], false];
	}
}

export async function encryptListContent(
	tags: string[][],
	legacy: boolean = false
): Promise<string> {
	if (tags.length === 0) {
		return '';
	}

	const $pubkey = get(pubkey);
	return legacy
		? Signer.encrypt($pubkey, JSON.stringify(tags))
		: Signer.encryptNip44($pubkey, JSON.stringify(tags));
}
