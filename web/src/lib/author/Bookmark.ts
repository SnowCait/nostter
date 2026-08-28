import { get, writable, type Writable } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { kinds as Kind } from 'nostr-tools';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { Signer } from '$lib/Signer';
import { WebStorage } from '$lib/WebStorage';
import { pubkey } from '../stores/Author';

type DataType = 'bookmark' | 'unbookmark';
type Data = {
	type: DataType;
	tag: string[];
};

let writeQueue = Promise.resolve();

export const bookmarkEvent: Writable<Nostr.Event | undefined> = writable();
export const legacyBookmarkEvent: Writable<Nostr.Event | undefined> = writable();

export function updateBookmarkTags(tags: string[][], data: Data): string[][] {
	if (
		data.type === 'bookmark' &&
		!tags.some(([tagName, value]) => tagName === data.tag[0] && value === data.tag[1])
	) {
		return [...tags, data.tag];
	}
	if (
		data.type === 'unbookmark' &&
		tags.some(([tagName, value]) => tagName === data.tag[0] && value === data.tag[1])
	) {
		return tags.filter(
			([tagName, value]) => !(tagName === data.tag[0] && value === data.tag[1])
		);
	}
	return tags;
}

// TODO: Private bookmarks
export const isBookmarked = (event: Nostr.Event): boolean => {
	const $bookmarkEvent = get(bookmarkEvent);
	if ($bookmarkEvent === undefined) {
		return false;
	}
	return $bookmarkEvent.tags.some(([tagName, id]) => tagName === 'e' && id === event.id);
};

export async function bookmark(tag: string[]): Promise<void> {
	await serialize(() => publish({ type: 'bookmark', tag }));
}

export async function unbookmark(tag: string[]): Promise<void> {
	await serialize(() => publish({ type: 'unbookmark', tag }));
}

function serialize(operation: () => Promise<void>): Promise<void> {
	const result = writeQueue.then(operation, operation);
	writeQueue = result.catch(() => undefined);
	return result;
}

async function publish(data: Data): Promise<void> {
	const storage = new WebStorage(localStorage);
	const $pubkey = get(pubkey);

	while (true) {
		const cached = storage.getReplaceableEvent(Kind.BookmarkList);
		const remote = await fetchBookmarkEvent($pubkey);
		if (cached !== undefined && remote === undefined) {
			throw new Error('Cache is outdated.');
		}

		const base = latestEvent(cached, remote);
		const tags = updateBookmarkTags(base?.tags ?? [], data);

		// Recheck before signing so a newer event observed during this write is not lost.
		const confirmedBase = latestEvent(base, await fetchBookmarkEvent($pubkey));
		if (confirmedBase?.id !== base?.id) {
			continue;
		}

		const event = await Signer.signEvent({
			kind: Kind.BookmarkList,
			content: base?.content ?? '',
			tags,
			created_at: Math.max(now(), (base?.created_at ?? 0) + 1)
		});

		await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));
		storage.setReplaceableEvent(event);
		bookmarkEvent.set(event);
		return;
	}
}

function fetchBookmarkEvent(author: string): Promise<Nostr.Event | undefined> {
	return fetchLastEvent({ kinds: [Kind.BookmarkList], authors: [author], limit: 1 });
}

export function latestEvent(
	left: Nostr.Event | undefined,
	right: Nostr.Event | undefined
): Nostr.Event | undefined {
	if (left === undefined) return right;
	if (right === undefined) return left;
	if (left.created_at !== right.created_at) {
		return left.created_at > right.created_at ? left : right;
	}
	return left.id < right.id ? left : right;
}
