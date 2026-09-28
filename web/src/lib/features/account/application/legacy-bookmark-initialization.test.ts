import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';

const { fetchDeletionRequests } = vi.hoisted(() => ({ fetchDeletionRequests: vi.fn() }));
vi.mock('$lib/features/event-deletion/application/fetch-address-deletion-requests', () => ({
	fetchAddressDeletionRequests: fetchDeletionRequests
}));

import { Author } from '$lib/Author';
import { db } from '$lib/cache/db';
import { accountAddressableEventCache } from '$lib/cache/Events';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { bookmarkEvent, legacyBookmarkEvent } from '$lib/author/Bookmark.svelte';
import { isDeletedByAddress } from '$lib/features/event-deletion/application/deletion-state';
import { prepareAccountInitialization } from './initialize-account';
import { applyAccountInitialization } from './apply-account-initialization';

const me = 'd'.repeat(64);
const legacyBookmarkAddress = `${Kind.Genericlists}:${me}:bookmark`;

function event(kind: number, created_at: number, tags: string[][] = []): Nostr.Event {
	return {
		id: `${kind}-${created_at}`,
		pubkey: me,
		kind,
		created_at,
		tags,
		content: '',
		sig: ''
	};
}

const standardBookmark = event(Kind.BookmarkList, 1, [['e', 'standard']]);

async function initialize(): Promise<void> {
	applyAccountInitialization(me, await prepareAccountInitialization(me));
}

beforeEach(async () => {
	vi.spyOn(Author.prototype, 'fetchRelays').mockResolvedValue();
	vi.spyOn(rxNostr, 'setDefaultRelays').mockImplementation(() => {});
	fetchDeletionRequests.mockReset();
	await accountAddressableEventCache.clear();
	await accountAddressableEventCache.put(standardBookmark);
	bookmarkEvent.set(undefined);
	legacyBookmarkEvent.set(undefined);
});
afterAll(async () => {
	vi.restoreAllMocks();
	await db.delete();
});

describe('legacy bookmark account initialization', () => {
	it('does not restore a cached legacy bookmark covered by a deletion request', async () => {
		const legacyBookmark = event(Kind.Genericlists, 10, [
			['d', 'bookmark'],
			['e', 'legacy']
		]);
		await accountAddressableEventCache.put(legacyBookmark);
		fetchDeletionRequests.mockResolvedValue([
			event(Kind.EventDeletion, 10, [['a', legacyBookmarkAddress]])
		]);

		await initialize();

		expect(fetchDeletionRequests).toHaveBeenCalledWith(me, [legacyBookmarkAddress]);
		expect(get(legacyBookmarkEvent)).toBeUndefined();
		expect(get(bookmarkEvent)).toEqual(standardBookmark);
		expect(isDeletedByAddress(legacyBookmark)).toBe(true);
	});

	it('restores a legacy bookmark published after the deletion request', async () => {
		const legacyBookmark = event(Kind.Genericlists, 11, [
			['d', 'bookmark'],
			['e', 'legacy']
		]);
		await accountAddressableEventCache.put(legacyBookmark);
		fetchDeletionRequests.mockResolvedValue([
			event(Kind.EventDeletion, 10, [['a', legacyBookmarkAddress]])
		]);

		await initialize();

		expect(get(legacyBookmarkEvent)).toEqual(legacyBookmark);
		expect(get(bookmarkEvent)).toEqual(standardBookmark);
	});
});
