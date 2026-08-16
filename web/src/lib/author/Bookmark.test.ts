import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/timelines/MainTimeline', () => ({ rxNostr: {} }));

import { bookmarkEvent, bookmarkKind, legacyBookmarkEvent, updateBookmarkTags } from './Bookmark';
import { get } from 'svelte/store';

describe('Bookmark', () => {
	it('uses the standard NIP-51 bookmark kind', () => {
		expect(bookmarkKind).toBe(10003);
	});

	it('adds and removes bookmark tags without an addressable-event identifier', () => {
		const added = updateBookmarkTags([], { type: 'bookmark', tag: ['e', 'event-id'] });
		expect(added).toEqual([['e', 'event-id']]);
		expect(updateBookmarkTags(added, { type: 'unbookmark', tag: ['e', 'event-id'] })).toEqual(
			[]
		);
	});

	it('keeps standard and legacy bookmark events in separate state', () => {
		const standard = { id: 'standard' } as never;
		const legacy = { id: 'legacy' } as never;

		bookmarkEvent.set(standard);
		legacyBookmarkEvent.set(legacy);

		expect(get(bookmarkEvent)).toBe(standard);
		expect(get(legacyBookmarkEvent)).toBe(legacy);
	});
});
