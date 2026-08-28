import { get } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { kinds as Kind } from 'nostr-tools';
import { legacyBookmarkIdentifier } from '$lib/Constants';
import { isLegacyEncryption } from '$lib/EventHelper';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { Signer } from '$lib/Signer';
import { pubkey } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { WebStorage } from '$lib/WebStorage';
import { bookmarkEvent, runBookmarkCopyExclusively } from './Bookmark';
import { isLegacyBookmarkEvent, mergeBookmarkReferences } from './BookmarkMigration';

function isTagCollection(value: unknown): value is string[][] {
	return (
		Array.isArray(value) &&
		value.every((tag) => Array.isArray(tag) && tag.every((item) => typeof item === 'string'))
	);
}

export async function decryptBookmarkContentStrict(
	pubkey: string,
	content: string
): Promise<string[][]> {
	if (content === '') {
		return [];
	}

	const plaintext = await (isLegacyEncryption(content)
		? Signer.decrypt(pubkey, content)
		: Signer.decryptNip44(pubkey, content));
	const tags: unknown = JSON.parse(plaintext);
	if (!isTagCollection(tags)) {
		throw new Error('Invalid bookmark content.');
	}
	return tags;
}

function tagsEqual(left: string[][], right: string[][]): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

export async function copyLegacyBookmarks(): Promise<Nostr.Event | undefined> {
	return runBookmarkCopyExclusively(async () => {
		const $pubkey = get(pubkey);
		const legacyEvent = await fetchLastEvent({
			kinds: [Kind.Genericlists],
			authors: [$pubkey],
			'#d': [legacyBookmarkIdentifier],
			limit: 1
		});
		if (legacyEvent === undefined) {
			throw new Error('Legacy bookmark event not found.');
		}
		if (!isLegacyBookmarkEvent(legacyEvent)) {
			throw new Error('Invalid legacy bookmark event.');
		}

		const storage = new WebStorage(localStorage);
		const cachedEvent = storage.getReplaceableEvent(Kind.BookmarkList);
		const standardEvent = await fetchLastEvent({
			kinds: [Kind.BookmarkList],
			authors: [$pubkey],
			limit: 1
		});
		if (standardEvent === undefined && cachedEvent !== undefined) {
			throw new Error('Standard bookmark cache freshness could not be verified.');
		}

		const existingPublic = standardEvent?.tags ?? [];
		const mergedPublic = mergeBookmarkReferences(existingPublic, legacyEvent.tags);
		const existingPrivate = await decryptBookmarkContentStrict(
			$pubkey,
			standardEvent?.content ?? ''
		);
		const legacyPrivate = await decryptBookmarkContentStrict($pubkey, legacyEvent.content);
		const mergedPrivate = mergeBookmarkReferences(existingPrivate, legacyPrivate);

		if (tagsEqual(existingPublic, mergedPublic) && tagsEqual(existingPrivate, mergedPrivate)) {
			return undefined;
		}

		const content =
			mergedPrivate.length === 0
				? ''
				: await Signer.encryptNip44($pubkey, JSON.stringify(mergedPrivate));
		const event = await Signer.signEvent({
			kind: Kind.BookmarkList,
			content,
			tags: mergedPublic,
			created_at: now()
		});

		await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));
		storage.setReplaceableEvent(event);
		bookmarkEvent.set(event);
		return event;
	});
}
