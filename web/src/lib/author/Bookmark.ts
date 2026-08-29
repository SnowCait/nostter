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
import { bookmarkCopyState } from './BookmarkCopyState.svelte';

type DataType = 'bookmark' | 'unbookmark';
type Data = {
	type: DataType;
	tag: string[];
};

const queue = new Queue<Data>();

let processing = false;
let copying = false;

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
	if (copying) {
		throw new Error('Bookmark copy is in progress.');
	}

	queue.enqueue({
		type,
		tag
	});

	if (!processing) {
		processing = true;
		bookmarkCopyState.beginNormalWrite();
		await publish();
		processing = false;
		bookmarkCopyState.endNormalWrite();
	}
}

export async function runBookmarkCopyExclusively<T>(copy: () => Promise<T>): Promise<T> {
	if (processing || queue.length > 0 || copying) {
		throw new Error('Bookmark operation is busy.');
	}

	copying = true;
	bookmarkCopyState.beginCopy();
	try {
		return await copy();
	} finally {
		copying = false;
		bookmarkCopyState.endCopy();
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

	bookmarkEvent.set(event);

	// Lazy validation for UX
	if (!(await validate(lastEvent))) {
		bookmarkEvent.set(lastEvent);
		throw new Error('Cache is outdated.');
	}

	storage.setReplaceableEvent(event);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

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
	} else if (lastEvent === undefined || event.created_at < lastEvent.created_at) {
		return false;
	}

	return true;
}
