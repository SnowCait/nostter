import type * as Nostr from 'nostr-typedef';
import { writable } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { legacyBookmarkListId, standardBookmarkListId } from './BookmarkListTabs';
import { BookmarkPageState } from './BookmarkPageState.svelte';

function bookmarkEvent(id: string): Nostr.Event {
	return { id, pubkey: '', created_at: 0, kind: 0, tags: [], content: '', sig: '' };
}

describe('Bookmark page state', () => {
	it('reacts to bookmark events loaded after initialization without mixing lists', () => {
		const standardEvent = writable<Nostr.Event | undefined>();
		const legacyEvent = writable<Nostr.Event | undefined>();
		const addItems = new Map<string, (item: string) => void>();
		const unsubscribed: string[] = [];
		const loadPublicItems = vi.fn((event: Nostr.Event, addItem: (item: string) => void) => {
			addItems.set(event.id, addItem);
			return () => unsubscribed.push(event.id);
		});
		const state = new BookmarkPageState(standardEvent, legacyEvent, loadPublicItems, (a, b) =>
			a.localeCompare(b)
		);
		expect(state.bookmarkListTabs.map(({ id }) => id)).toEqual([standardBookmarkListId]);
		expect(state.selectedBookmarkListId).toBe(standardBookmarkListId);
		expect(state.selectionFinalized).toBe(false);
		expect(loadPublicItems).not.toHaveBeenCalled();

		legacyEvent.set(bookmarkEvent('legacy-1'));
		expect(state.bookmarkListTabs.map(({ id }) => id)).toEqual([
			standardBookmarkListId,
			legacyBookmarkListId
		]);
		expect(state.selectedBookmarkListId).toBe(legacyBookmarkListId);
		expect(loadPublicItems).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'legacy-1' }),
			expect.any(Function)
		);
		addItems.get('legacy-1')?.('legacy item');
		expect(state.publicLegacyBookmarkEventItems).toEqual(['legacy item']);

		state.selectBookmarkList(standardBookmarkListId);
		standardEvent.set(bookmarkEvent('standard-1'));
		addItems.get('standard-1')?.('standard item');
		expect(state.selectedBookmarkListId).toBe(standardBookmarkListId);
		expect(state.publicBookmarkEventItems).toEqual(['standard item']);
		expect(state.publicLegacyBookmarkEventItems).toEqual(['legacy item']);

		legacyEvent.set(bookmarkEvent('legacy-2'));
		expect(unsubscribed).toContain('legacy-1');
		expect(state.publicLegacyBookmarkEventItems).toEqual([]);
		expect(state.publicBookmarkEventItems).toEqual(['standard item']);
		expect(state.selectedBookmarkListId).toBe(standardBookmarkListId);

		state.destroy();
		expect(unsubscribed).toEqual(expect.arrayContaining(['standard-1', 'legacy-2']));
	});
});
