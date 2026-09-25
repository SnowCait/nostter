import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type * as Nostr from 'nostr-typedef';
import { kinds as Kind } from 'nostr-tools';
import { legacyBookmarkIdentifier } from '$lib/Constants';

const mocks = vi.hoisted(() => ({
	userPubkey: 'f'.repeat(64),
	signEvent: vi.fn(),
	requestEventDeletion: vi.fn()
}));

const cache = vi.hoisted(() => new Map<string, Nostr.Event>());
vi.mock('$lib/cache/Events', () => ({
	accountAddressableEventCache: {
		get: async (pubkey: string, kind: number, identifier = '') =>
			cache.get(`${pubkey}:${kind}:${identifier}`),
		put: async (event: Nostr.Event) => {
			cache.set(
				`${event.pubkey}:${event.kind}:${event.tags.find(([name]) => name === 'd')?.[1] ?? ''}`,
				event
			);
			return true;
		},
		remove: async (pubkey: string, kind: number, identifier = '') => {
			cache.delete(`${pubkey}:${kind}:${identifier}`);
		}
	}
}));
vi.mock('$lib/author/Bookmark.svelte', async () => {
	const { writable } = await import('svelte/store');
	return { legacyBookmarkEvent: writable() };
});
vi.mock('$lib/features/event-deletion/application/request-event-deletion', () => ({
	requestEventDeletion: mocks.requestEventDeletion
}));

import { accountAddressableEventCache } from '$lib/cache/Events';
import { legacyBookmarkEvent } from '$lib/author/Bookmark.svelte';
import { deleteLegacyBookmarks } from './delete-legacy-bookmarks';

function event(kind: number, identifier?: string): Nostr.Event {
	return {
		id: `${kind}-${identifier ?? 'event'}`,
		kind,
		pubkey: mocks.userPubkey,
		content: '',
		tags: identifier === undefined ? [] : [['d', identifier]],
		created_at: 1,
		sig: 'sig'
	};
}

beforeEach(() => {
	vi.resetAllMocks();
	cache.clear();
	legacyBookmarkEvent.set(undefined);
});

describe('deleteLegacyBookmarks', () => {
	it('cleans up only the legacy bookmark after relay acceptance', async () => {
		const legacyEvent = event(Kind.Genericlists, legacyBookmarkIdentifier);
		const otherParameterizedEvent = event(Kind.Genericlists, 'other-list');
		const standardBookmarkEvent = event(Kind.BookmarkList);
		await accountAddressableEventCache.put(legacyEvent);
		await accountAddressableEventCache.put(otherParameterizedEvent);
		await accountAddressableEventCache.put(standardBookmarkEvent);
		legacyBookmarkEvent.set(legacyEvent);
		const acceptance = Promise.withResolvers<void>();
		mocks.requestEventDeletion.mockReturnValue(acceptance.promise);

		const deletion = deleteLegacyBookmarks(mocks.signEvent);
		await vi.waitFor(() => expect(mocks.requestEventDeletion).toHaveBeenCalledOnce());

		expect(mocks.requestEventDeletion).toHaveBeenCalledWith(mocks.signEvent, [legacyEvent]);
		expect(
			await accountAddressableEventCache.get(
				mocks.userPubkey,
				Kind.Genericlists,
				legacyBookmarkIdentifier
			)
		).toEqual(legacyEvent);
		expect(get(legacyBookmarkEvent)).toEqual(legacyEvent);

		acceptance.resolve();
		await expect(deletion).resolves.toBeUndefined();

		expect(
			await accountAddressableEventCache.get(
				mocks.userPubkey,
				Kind.Genericlists,
				legacyBookmarkIdentifier
			)
		).toBeUndefined();
		expect(
			await accountAddressableEventCache.get(
				mocks.userPubkey,
				Kind.Genericlists,
				'other-list'
			)
		).toEqual(otherParameterizedEvent);
		expect(await accountAddressableEventCache.get(mocks.userPubkey, Kind.BookmarkList)).toEqual(
			standardBookmarkEvent
		);
		expect(get(legacyBookmarkEvent)).toBeUndefined();
	});

	it('preserves the cache and state when the deletion request fails', async () => {
		const legacyEvent = event(Kind.Genericlists, legacyBookmarkIdentifier);
		await accountAddressableEventCache.put(legacyEvent);
		legacyBookmarkEvent.set(legacyEvent);
		mocks.requestEventDeletion.mockRejectedValue(new Error('relay rejected'));

		await expect(deleteLegacyBookmarks(mocks.signEvent)).rejects.toThrow('relay rejected');

		expect(
			await accountAddressableEventCache.get(
				mocks.userPubkey,
				Kind.Genericlists,
				legacyBookmarkIdentifier
			)
		).toEqual(legacyEvent);
		expect(get(legacyBookmarkEvent)).toEqual(legacyEvent);
	});
});
