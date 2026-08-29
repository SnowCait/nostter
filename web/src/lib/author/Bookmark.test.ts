import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { kinds as Kind } from 'nostr-tools';

const { signEvent } = vi.hoisted(() => ({
	signEvent: vi.fn(async (event) => ({ ...event, id: 'signed', pubkey: 'pubkey', sig: 'sig' }))
}));

vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: { send: () => of({ ok: true }) }
}));
vi.mock('$lib/Signer', () => ({ Signer: { signEvent } }));
vi.mock('$lib/RxNostrHelper', () => ({ fetchLastEvent: vi.fn(async () => undefined) }));
vi.mock('$lib/WebStorage', () => ({
	WebStorage: class {
		getReplaceableEvent() {
			return undefined;
		}

		setReplaceableEvent() {}
	}
}));
vi.stubGlobal('localStorage', {});

import {
	bookmark,
	bookmarkEvent,
	legacyBookmarkEvent,
	updateBookmarkTags
} from './Bookmark.svelte';
import { get } from 'svelte/store';

describe('Bookmark', () => {
	it('publishes updates as the standard NIP-51 bookmark kind', async () => {
		await bookmark(['e', 'event-id']);

		expect(signEvent).toHaveBeenCalledWith(
			expect.objectContaining({ kind: Kind.BookmarkList })
		);
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
