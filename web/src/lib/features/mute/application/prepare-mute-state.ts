import type { Event } from 'nostr-tools';
import { filterTags } from '$lib/EventHelper';
import { findIdentifier } from '$lib/nostr/protocol/event-address';
import type { ListContentDecrypter } from '$lib/List';

export type PreparedMuteTags = {
	pubkeys: string[];
	eventIds: string[];
	words: string[];
};

export function prepareMuteTags(tags: string[][], accountPubkey: string): PreparedMuteTags {
	return {
		pubkeys: [...new Set(filterTags('p', tags).filter((pubkey) => pubkey !== accountPubkey))],
		eventIds: [...new Set(filterTags('e', tags))],
		words: [...new Set(filterTags('word', tags))]
	};
}

export async function prepareMuteTagsFromEvent(
	event: Event,
	accountPubkey: string,
	decryptPrivateListContent?: ListContentDecrypter
): Promise<PreparedMuteTags> {
	const [privateTags] =
		decryptPrivateListContent === undefined
			? [[], false]
			: await decryptPrivateListContent(event.pubkey, event.content);
	return prepareMuteTags([...event.tags, ...privateTags], accountPubkey);
}

export async function prepareMutedPubkeysByKind(
	events: Event[],
	decryptPrivateListContent?: ListContentDecrypter
): Promise<Map<number, Set<string>>> {
	const updates = new Map<number, Set<string>>();
	for (const event of events) {
		const kind = findIdentifier(event.tags);
		if (!kind || isNaN(Number(kind))) {
			continue;
		}
		const privateTags: string[][] = [];
		if (event.content !== '' && decryptPrivateListContent !== undefined) {
			try {
				const [tags] = await decryptPrivateListContent(event.pubkey, event.content);
				privateTags.push(...tags);
			} catch (error) {
				console.warn('[kind 30007 content parse error]', event, error);
			}
		}
		updates.set(Number(kind), new Set(filterTags('p', [...event.tags, ...privateTags])));
	}
	return updates;
}
