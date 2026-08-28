import { get, writable, type Writable } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { kinds as Kind } from 'nostr-tools';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { Signer } from '$lib/Signer';
import { WebStorage } from '$lib/WebStorage';
import { pubkey } from '../stores/Author';

type DataType = 'bookmark' | 'unbookmark';
type Data = {
	type: DataType;
	tag: string[];
};

const queue = new Queue<Data>();

let processing = false;

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
	console.log('[bookmark]', tag, queue.dump());
	await save('bookmark', tag);
}

export async function unbookmark(tag: string[]): Promise<void> {
	console.log('[unbookmark]', tag, queue.dump());
	await save('unbookmark', tag);
}

async function save(type: DataType, tag: string[]): Promise<void> {
	queue.enqueue({
		type,
		tag
	});

	if (!processing) {
		await processQueue();
	}
}

async function processQueue(): Promise<void> {
	processing = true;
	try {
		await publish();
	} finally {
		processing = false;
		if (queue.length > 0) {
			void processQueue().catch((error) => console.error('[bookmark queue]', error));
		}
	}
}

async function publish(): Promise<void> {
	const storage = new WebStorage(localStorage);
	const lastEvent = storage.getReplaceableEvent(Kind.BookmarkList);
	let tags = lastEvent?.tags ?? [];

	while (queue.length > 0) {
		const data = queue.dequeue();
		if (data === undefined) {
			break;
		}

		tags = updateBookmarkTags(tags, data);
	}

	const event = await Signer.signEvent({
		kind: Kind.BookmarkList,
		content: lastEvent?.content ?? '',
		tags,
		created_at: now()
	});

	const previousEvent = get(bookmarkEvent);
	bookmarkEvent.set(event);

	try {
		// Lazy validation for UX
		if (!(await validate(lastEvent))) {
			throw new Error('Cache is outdated.');
		}

		await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));
	} catch (error) {
		if (get(bookmarkEvent)?.id === event.id) {
			bookmarkEvent.set(previousEvent);
		}
		throw error;
	}

	storage.setReplaceableEvent(event);

	if (queue.length > 0) {
		await publish();
	}
}

async function validate(event: Nostr.Event | undefined): Promise<boolean> {
	const $pubkey = get(pubkey);
	const lastEvent = await fetchLastEvent({
		kinds: [Kind.BookmarkList],
		authors: [$pubkey],
		limit: 1
	});

	if (event === undefined) {
		if (lastEvent !== undefined) {
			return false;
		}
	} else if (lastEvent === undefined || !isLatestReplaceableEvent(event, lastEvent)) {
		return false;
	}

	return true;
}

export function isLatestReplaceableEvent(event: Nostr.Event, other: Nostr.Event): boolean {
	if (event.created_at !== other.created_at) {
		return event.created_at > other.created_at;
	}
	return event.id <= other.id;
}
