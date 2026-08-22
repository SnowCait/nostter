import { get, writable, type Writable } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { kinds as Kind } from 'nostr-tools';
import { decryptListContentStrict, encryptListContent } from '$lib/List';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { Signer } from '$lib/Signer';
import { pubkey } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { WebStorage } from '$lib/WebStorage';
import { legacyBookmarkIdentifier } from '$lib/Constants';
import { deleteAddressableEvent } from './Delete';

type DataType = 'bookmark' | 'unbookmark';
type Data = { type: DataType; tag: string[] };

let writeQueue = Promise.resolve();

export const bookmarkEvent: Writable<Nostr.Event | undefined> = writable();
export const legacyBookmarkEvent: Writable<Nostr.Event | undefined> = writable();

export function updateBookmarkTags(tags: string[][], data: Data): string[][] {
	if (data.type === 'bookmark' && !hasReference(tags, data.tag)) return [...tags, data.tag];
	if (data.type === 'unbookmark' && hasReference(tags, data.tag)) {
		return tags.filter((tag) => !sameReference(tag, data.tag));
	}
	return tags;
}

const isBookmarkReference = ([name, value]: string[]): boolean =>
	(name === 'e' || name === 'a') && value !== undefined;
const sameReference = (left: string[], right: string[]): boolean =>
	left[0] === right[0] && left[1] === right[1];
const hasReference = (tags: string[][], reference: string[]): boolean =>
	tags.some((tag) => sameReference(tag, reference));

export const mergeBookmarkReferences = (
	destination: string[][],
	source: string[][]
): string[][] => {
	const merged = destination.map((tag) => [...tag]);
	for (const tag of source.filter(isBookmarkReference)) {
		if (!hasReference(merged, tag)) merged.push([...tag]);
	}
	return merged;
};

export const isBookmarked = (event: Nostr.Event): boolean =>
	get(bookmarkEvent)?.tags.some(([name, id]) => name === 'e' && id === event.id) ?? false;

function serialize<T>(operation: () => Promise<T>): Promise<T> {
	const result = writeQueue.then(operation, operation);
	writeQueue = result.then(
		() => undefined,
		() => undefined
	);
	return result;
}

export async function bookmark(tag: string[]): Promise<void> {
	await serialize(() => updateStandardBookmarks({ type: 'bookmark', tag }));
}

export async function unbookmark(tag: string[]): Promise<void> {
	await serialize(() => updateStandardBookmarks({ type: 'unbookmark', tag }));
}

export async function copyLegacyBookmarks(): Promise<Nostr.Event> {
	const source = get(legacyBookmarkEvent);
	if (source === undefined) throw new Error('Old-format bookmarks were not found.');
	return serialize(async () => {
		const [privateSourceTags] = await decryptListContentStrict(source.pubkey, source.content);
		return publishStandardBookmarks(async (base) => {
			const [privateDestinationTags] = await decryptListContentStrict(
				base?.pubkey ?? get(pubkey),
				base?.content ?? ''
			);
			return {
				publicTags: mergeBookmarkReferences(base?.tags ?? [], source.tags),
				privateTags: mergeBookmarkReferences(privateDestinationTags, privateSourceTags)
			};
		});
	});
}

export async function deleteLegacyBookmarks(): Promise<void> {
	const $pubkey = get(pubkey);
	await deleteAddressableEvent(Kind.Genericlists, $pubkey, legacyBookmarkIdentifier);
	new WebStorage(localStorage).removeParameterizedReplaceableEvent(
		Kind.Genericlists,
		legacyBookmarkIdentifier
	);
	legacyBookmarkEvent.set(undefined);
}

async function updateStandardBookmarks(data: Data): Promise<void> {
	await publishStandardBookmarks((base) => ({
		publicTags: updateBookmarkTags(base?.tags ?? [], data),
		content: base?.content ?? ''
	}));
}

type BookmarkUpdate =
	| { publicTags: string[][]; content: string }
	| { publicTags: string[][]; privateTags: string[][] };

async function publishStandardBookmarks(
	update: (base: Nostr.Event | undefined) => BookmarkUpdate | Promise<BookmarkUpdate>
): Promise<Nostr.Event> {
	const storage = new WebStorage(localStorage);
	const $pubkey = get(pubkey);
	const cached = storage.getReplaceableEvent(Kind.BookmarkList);
	const remote = await fetchLastEvent({
		kinds: [Kind.BookmarkList],
		authors: [$pubkey],
		limit: 1
	});
	if (cached !== undefined && remote === undefined) throw new Error('Cache is outdated.');
	const base = latestEvent(cached, remote);
	const updated = await update(base);

	// Check once more immediately before signing so an event observed during the merge is not lost.
	const latestRemote = await fetchLastEvent({
		kinds: [Kind.BookmarkList],
		authors: [$pubkey],
		limit: 1
	});
	if (
		latestRemote !== undefined &&
		latestRemote.id !== remote?.id &&
		latestRemote.id !== base?.id
	) {
		return publishStandardBookmarks(update);
	}

	const event = await Signer.signEvent({
		kind: Kind.BookmarkList,
		content:
			'content' in updated ? updated.content : await encryptListContent(updated.privateTags),
		tags: updated.publicTags,
		created_at: Math.max(now(), (base?.created_at ?? 0) + 1)
	});
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));
	storage.setReplaceableEvent(event);
	bookmarkEvent.set(event);
	return event;
}

export function latestEvent(
	left: Nostr.Event | undefined,
	right: Nostr.Event | undefined
): Nostr.Event | undefined {
	if (left === undefined) return right;
	if (right === undefined) return left;
	if (left.created_at !== right.created_at)
		return left.created_at > right.created_at ? left : right;
	return left.id < right.id ? left : right;
}
