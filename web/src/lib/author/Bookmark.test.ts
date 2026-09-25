import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { kinds as Kind } from 'nostr-tools';

const { signEvent, send, cacheAccountEvent } = vi.hoisted(() => ({
	signEvent: vi.fn(async (event) => ({
		...event,
		id: 'signed',
		pubkey: 'account-pubkey',
		sig: 'sig'
	})),
	send: vi.fn(() => of({ ok: true })),
	cacheAccountEvent: vi.fn(async () => true)
}));

const { accountPubkey } = await vi.hoisted(async () => {
	const { writable } = await import('svelte/store');
	return { accountPubkey: writable<string | undefined>('account-pubkey') };
});

vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: { send }
}));
vi.mock('$lib/RxNostrHelper', () => ({ fetchLastEvent: vi.fn(async () => undefined) }));
vi.mock('$lib/auth.svelte', async () => {
	const { get } = await import('svelte/store');
	return {
		auth: {
			get pubkey() {
				return get(accountPubkey);
			}
		}
	};
});
vi.mock('$lib/cache/Events', () => ({
	accountAddressableEventCache: { get: vi.fn(async () => undefined) },
	cacheAccountEvent
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
		await bookmark(signEvent, ['e', 'event-id']);

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

	it('does not queue a bookmark that failed without an account', async () => {
		accountPubkey.set(undefined);
		await expect(bookmark(signEvent, ['e', 'anonymous-id'])).rejects.toThrow(
			'Not authenticated'
		);

		accountPubkey.set('account-pubkey');
		await bookmark(signEvent, ['e', 'authenticated-id']);

		expect(signEvent).toHaveBeenLastCalledWith(
			expect.objectContaining({ tags: [['e', 'authenticated-id']] })
		);
	});
});

describe('publication account ownership', () => {
	it('rejects a signer result from B before cache, relay, or optimistic state update', async () => {
		const enteredSigning = Promise.withResolvers<void>();
		const signed =
			Promise.withResolvers<
				ReturnType<typeof signEvent> extends Promise<infer T> ? T : never
			>();
		signEvent.mockImplementationOnce(async () => {
			enteredSigning.resolve();
			return signed.promise;
		});
		bookmarkEvent.set(undefined);
		send.mockClear();
		cacheAccountEvent.mockClear();
		const publication = bookmark(signEvent, ['e', 'account-switch-event']);
		await enteredSigning.promise;
		accountPubkey.set('other-account-pubkey');
		signed.resolve({
			id: 'wrong-account',
			pubkey: 'other-account-pubkey',
			kind: Kind.BookmarkList,
			tags: [],
			content: '',
			created_at: 1,
			sig: 'sig'
		});
		await expect(publication).rejects.toThrow('publication account');
		expect(cacheAccountEvent).not.toHaveBeenCalled();
		expect(send).not.toHaveBeenCalled();
		expect(get(bookmarkEvent)).toBeUndefined();
		accountPubkey.set('account-pubkey');
	});
});
