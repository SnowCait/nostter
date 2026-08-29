import { get } from 'svelte/store';
import { createRxBackwardReq, latestEach, now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { kinds as Kind } from 'nostr-tools';
import { legacyBookmarkIdentifier } from '$lib/Constants';
import { isLegacyEncryption } from '$lib/EventHelper';
import { Signer } from '$lib/Signer';
import { pubkey } from '$lib/stores/Author';
import { rxNostr, tie } from '$lib/timelines/MainTimeline';
import { WebStorage } from '$lib/WebStorage';
import { bookmarkEvent, runBookmarkCopyExclusively } from './Bookmark.svelte';
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

async function fetchBookmarkSources(pubkey: string): Promise<{
	legacyEvent: Nostr.Event | undefined;
	standardEvent: Nostr.Event | undefined;
}> {
	return new Promise((resolve) => {
		let legacyEvent: Nostr.Event | undefined;
		let standardEvent: Nostr.Event | undefined;
		const req = createRxBackwardReq();
		const done = () => resolve({ legacyEvent, standardEvent });

		rxNostr
			.use(req)
			.pipe(
				tie,
				latestEach(({ event }) => event.kind)
			)
			.subscribe({
				next: ({ event }) => {
					if (event.kind === Kind.Genericlists) {
						legacyEvent = event;
					} else if (event.kind === Kind.BookmarkList) {
						standardEvent = event;
					}
				},
				complete: done,
				error: (error) => {
					console.warn('[bookmark sources error]', error);
					done();
				}
			});
		req.emit([
			{
				kinds: [Kind.Genericlists],
				authors: [pubkey],
				'#d': [legacyBookmarkIdentifier],
				limit: 1
			},
			{
				kinds: [Kind.BookmarkList],
				authors: [pubkey],
				limit: 1
			}
		]);
		req.over();
	});
}

export async function copyLegacyBookmarks(): Promise<Nostr.Event | undefined> {
	return runBookmarkCopyExclusively(async () => {
		const $pubkey = get(pubkey);
		const { legacyEvent, standardEvent } = await fetchBookmarkSources($pubkey);
		if (legacyEvent === undefined) {
			throw new Error('Legacy bookmark event not found.');
		}
		if (!isLegacyBookmarkEvent(legacyEvent)) {
			throw new Error('Invalid legacy bookmark event.');
		}

		const storage = new WebStorage(localStorage);
		const cachedEvent = storage.getReplaceableEvent(Kind.BookmarkList);
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
