import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type * as Nostr from 'nostr-typedef';
import { kinds as Kind } from 'nostr-tools';
import { legacyBookmarkIdentifier } from '$lib/Constants';

const mocks = vi.hoisted(() => ({
	userPubkey: 'f'.repeat(64),
	requestEventDeletion: vi.fn()
}));

vi.mock('$lib/stores/Author', async () => {
	const { writable } = await import('svelte/store');
	return { pubkey: writable(mocks.userPubkey) };
});
vi.mock('$lib/cache/Events', () => ({
	eventCache: { addIfNotExists: vi.fn() }
}));
vi.mock('./Bookmark.svelte', async () => {
	const { writable } = await import('svelte/store');
	return { legacyBookmarkEvent: writable() };
});
vi.mock('../features/event-deletion/application/request-event-deletion', () => ({
	requestEventDeletion: mocks.requestEventDeletion
}));

import { WebStorage } from '$lib/WebStorage';
import { legacyBookmarkEvent } from './Bookmark.svelte';
import { deleteLegacyBookmarks } from './legacy-bookmark-delete';

class MemoryStorage implements Storage {
	readonly #items = new Map<string, string>();

	get length(): number {
		return this.#items.size;
	}

	clear(): void {
		this.#items.clear();
	}

	getItem(key: string): string | null {
		return this.#items.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.#items.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.#items.delete(key);
	}

	setItem(key: string, value: string): void {
		this.#items.set(key, value);
	}
}

const localStorage = new MemoryStorage();
vi.stubGlobal('localStorage', localStorage);

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
	localStorage.clear();
	legacyBookmarkEvent.set(undefined);
});

describe('deleteLegacyBookmarks', () => {
	it('cleans up only the legacy bookmark after relay acceptance', async () => {
		const legacyEvent = event(Kind.Genericlists, legacyBookmarkIdentifier);
		const otherParameterizedEvent = event(Kind.Genericlists, 'other-list');
		const standardBookmarkEvent = event(Kind.BookmarkList);
		const storage = new WebStorage(localStorage);
		storage.setParameterizedReplaceableEvent(legacyEvent);
		storage.setParameterizedReplaceableEvent(otherParameterizedEvent);
		storage.setReplaceableEvent(standardBookmarkEvent);
		const cachedAt = storage.getCachedAt();
		legacyBookmarkEvent.set(legacyEvent);
		const acceptance = Promise.withResolvers<void>();
		mocks.requestEventDeletion.mockReturnValue(acceptance.promise);

		const deletion = deleteLegacyBookmarks();
		await vi.waitFor(() => expect(mocks.requestEventDeletion).toHaveBeenCalledOnce());

		expect(mocks.requestEventDeletion).toHaveBeenCalledWith([legacyEvent]);
		expect(
			storage.getParameterizedReplaceableEvent(Kind.Genericlists, legacyBookmarkIdentifier)
		).toEqual(legacyEvent);
		expect(get(legacyBookmarkEvent)).toEqual(legacyEvent);

		acceptance.resolve();
		await expect(deletion).resolves.toBeUndefined();

		expect(
			storage.getParameterizedReplaceableEvent(Kind.Genericlists, legacyBookmarkIdentifier)
		).toBeUndefined();
		expect(storage.getParameterizedReplaceableEvent(Kind.Genericlists, 'other-list')).toEqual(
			otherParameterizedEvent
		);
		expect(storage.getReplaceableEvent(Kind.BookmarkList)).toEqual(standardBookmarkEvent);
		expect(storage.getCachedAt()).toBe(cachedAt);
		expect(get(legacyBookmarkEvent)).toBeUndefined();
	});

	it('preserves the cache and state when the deletion request fails', async () => {
		const legacyEvent = event(Kind.Genericlists, legacyBookmarkIdentifier);
		const storage = new WebStorage(localStorage);
		storage.setParameterizedReplaceableEvent(legacyEvent);
		legacyBookmarkEvent.set(legacyEvent);
		mocks.requestEventDeletion.mockRejectedValue(new Error('relay rejected'));

		await expect(deleteLegacyBookmarks()).rejects.toThrow('relay rejected');

		expect(
			storage.getParameterizedReplaceableEvent(Kind.Genericlists, legacyBookmarkIdentifier)
		).toEqual(legacyEvent);
		expect(get(legacyBookmarkEvent)).toEqual(legacyEvent);
	});
});
