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
import { addressRegexp, hexRegexp, legacyBookmarkIdentifier } from '$lib/Constants';
import { findIdentifier, isLegacyEncryption } from '$lib/EventHelper';

type DataType = 'bookmark' | 'unbookmark';
type BookmarkData = {
	type: DataType;
	tag: string[];
};
type CopyData = {
	type: 'copy';
	event: Nostr.Event;
	resolve: () => void;
	reject: (reason?: unknown) => void;
};
type Data = BookmarkData | CopyData;

const queue = new Queue<Data>();

let processing = false;

export const bookmarkEvent: Writable<Nostr.Event | undefined> = writable();
export const legacyBookmarkEvent: Writable<Nostr.Event | undefined> = writable();

export function updateBookmarkTags(tags: string[][], data: BookmarkData): string[][] {
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

export function copyLegacyBookmarks(event: Nostr.Event): Promise<void> {
	return new Promise((resolve, reject) => {
		queue.enqueue({ type: 'copy', event, resolve, reject });

		if (!processing) {
			processing = true;
			void publish().then(
				() => {
					processing = false;
				},
				(error) => reject(error)
			);
		}
	});
}

async function save(type: DataType, tag: string[]): Promise<void> {
	queue.enqueue({
		type,
		tag
	});

	if (!processing) {
		processing = true;
		await publish();
		processing = false;
	}
}

async function publish(baseEvent?: Nostr.Event, serializingCopy: boolean = false): Promise<void> {
	const storage = new WebStorage(localStorage);
	const lastEvent = baseEvent ?? storage.getReplaceableEvent(Kind.BookmarkList);
	let tags = lastEvent?.tags.concat() ?? [];
	let privateTags: string[][] | undefined;
	const copyOperations: CopyData[] = [];
	let shouldPublish = false;

	while (queue.length > 0) {
		const data = queue.dequeue();
		if (data === undefined) {
			break;
		}

		if (data.type !== 'copy') {
			tags = updateBookmarkTags(tags, data);
			shouldPublish = true;
			continue;
		}

		try {
			validateLegacyBookmarkEvent(data.event);
			privateTags ??= await decryptBookmarkContentStrict(
				lastEvent?.pubkey ?? get(pubkey),
				lastEvent?.content ?? ''
			);
			const legacyPrivateTags = await decryptBookmarkContentStrict(
				data.event.pubkey,
				data.event.content
			);
			tags = mergeBookmarkReferences(tags, data.event.tags);
			privateTags = mergeBookmarkReferences(privateTags, legacyPrivateTags);
			copyOperations.push(data);
			shouldPublish = true;
		} catch (error) {
			data.reject(error);
		}
	}

	if (!shouldPublish) {
		return;
	}

	const copySequence = serializingCopy || copyOperations.length > 0;
	let event: Nostr.Event;

	try {
		event = await Signer.signEvent({
			kind: Kind.BookmarkList,
			content:
				privateTags === undefined
					? (lastEvent?.content ?? '')
					: await encryptBookmarkContent(privateTags),
			tags,
			created_at: copySequence ? Math.max(now(), (lastEvent?.created_at ?? -1) + 1) : now()
		});

		bookmarkEvent.set(event);

		// Lazy validation for UX
		if (!(await validate(lastEvent))) {
			bookmarkEvent.set(lastEvent);
			throw new Error('Cache is outdated.');
		}

		if (copyOperations.length > 0) {
			await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));
			storage.setReplaceableEvent(event);
		} else {
			storage.setReplaceableEvent(event);
			await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));
		}
	} catch (error) {
		if (copyOperations.length > 0) {
			bookmarkEvent.set(lastEvent);
			copyOperations.forEach(({ reject }) => reject(error));
		}
		throw error;
	}

	copyOperations.forEach(({ resolve }) => resolve());

	if (queue.length > 0) {
		const copyPending = queue.dump().some(({ type }) => type === 'copy');
		await publish(copySequence || copyPending ? event : undefined, copySequence || copyPending);
	}
}

function validateLegacyBookmarkEvent(event: Nostr.Event): void {
	if (
		event.kind !== Kind.Genericlists ||
		findIdentifier(event.tags) !== legacyBookmarkIdentifier
	) {
		throw new Error('Invalid old-format bookmark event.');
	}
}

function isBookmarkReference([name, value]: string[]): boolean {
	return (
		(name === 'e' && hexRegexp.test(value ?? '')) ||
		(name === 'a' && addressRegexp.test(value ?? ''))
	);
}

function mergeBookmarkReferences(tags: string[][], source: string[][]): string[][] {
	const merged = tags.concat();
	for (const tag of source.filter(isBookmarkReference)) {
		if (!merged.some(([name, value]) => name === tag[0] && value === tag[1])) {
			merged.push(tag.concat());
		}
	}
	return merged;
}

async function decryptBookmarkContentStrict(pubkey: string, content: string): Promise<string[][]> {
	if (content === '') {
		return [];
	}

	const plaintext = await (isLegacyEncryption(content)
		? Signer.decrypt(pubkey, content)
		: Signer.decryptNip44(pubkey, content));
	const parsed: unknown = JSON.parse(plaintext);
	if (
		!Array.isArray(parsed) ||
		!parsed.every(
			(tag) => Array.isArray(tag) && tag.every((value) => typeof value === 'string')
		)
	) {
		throw new Error('Invalid private bookmark content.');
	}
	return parsed;
}

async function encryptBookmarkContent(tags: string[][]): Promise<string> {
	if (tags.length === 0) {
		return '';
	}
	return Signer.encryptNip44(get(pubkey), JSON.stringify(tags));
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
