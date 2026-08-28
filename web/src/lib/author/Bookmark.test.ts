import { get } from 'svelte/store';
import { of, Subject, throwError, type Observable } from 'rxjs';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	stored: undefined as Nostr.Event | undefined,
	remote: undefined as Nostr.Event | undefined,
	mirrorStored: true,
	pendingSend: undefined as Observable<{ ok: boolean }> | undefined,
	sendFails: false,
	sent: [] as Nostr.Event[],
	setCalls: [] as Nostr.Event[],
	signCount: 0
}));

vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: {
		send: (event: Nostr.Event) => {
			mocks.sent.push(event);
			if (mocks.pendingSend !== undefined) {
				const pending = mocks.pendingSend;
				mocks.pendingSend = undefined;
				return pending;
			}
			return mocks.sendFails ? throwError(() => new Error('rejected')) : of({ ok: true });
		}
	}
}));
vi.mock('$lib/Signer', () => ({
	Signer: {
		signEvent: vi.fn(async (unsigned) => ({
			...unsigned,
			id: `signed-${++mocks.signCount}`,
			pubkey: 'pubkey',
			sig: 'sig'
		}))
	}
}));
vi.mock('$lib/RxNostrHelper', () => ({
	fetchLastEvent: vi.fn(async () => (mocks.mirrorStored ? mocks.stored : mocks.remote))
}));
vi.mock('$lib/stores/Author', async () => {
	const { writable } = await import('svelte/store');
	return { pubkey: writable('pubkey') };
});
vi.mock('$lib/WebStorage', () => ({
	WebStorage: class {
		getReplaceableEvent() {
			return mocks.stored;
		}

		setReplaceableEvent(event: Nostr.Event) {
			mocks.setCalls.push(event);
			mocks.stored = event;
		}
	}
}));
vi.stubGlobal('localStorage', {});

import {
	bookmark,
	bookmarkEvent,
	isLatestReplaceableEvent,
	legacyBookmarkEvent,
	unbookmark,
	updateBookmarkTags
} from './Bookmark';

const event = (values: Partial<Nostr.Event>): Nostr.Event =>
	({
		id: 'event',
		pubkey: 'pubkey',
		kind: Kind.BookmarkList,
		created_at: 10,
		content: '',
		tags: [],
		sig: 'sig',
		...values
	}) as Nostr.Event;

describe('Bookmark', () => {
	beforeEach(() => {
		mocks.stored = undefined;
		mocks.remote = undefined;
		mocks.mirrorStored = true;
		mocks.pendingSend = undefined;
		mocks.sendFails = false;
		mocks.sent = [];
		mocks.setCalls = [];
		mocks.signCount = 0;
		bookmarkEvent.set(undefined);
		legacyBookmarkEvent.set(undefined);
	});

	it('publishes updates as the standard NIP-51 bookmark kind', async () => {
		await bookmark(['e', 'event-id']);

		expect(mocks.sent[0]).toEqual(expect.objectContaining({ kind: Kind.BookmarkList }));
	});

	it('adds and removes bookmark tags without an addressable-event identifier', () => {
		const added = updateBookmarkTags([], { type: 'bookmark', tag: ['e', 'event-id'] });
		expect(added).toEqual([['e', 'event-id']]);
		expect(updateBookmarkTags(added, { type: 'unbookmark', tag: ['e', 'event-id'] })).toEqual(
			[]
		);
	});

	it('keeps standard and legacy bookmark events in separate state', () => {
		const standard = event({ id: 'standard' });
		const legacy = event({ id: 'legacy' });

		bookmarkEvent.set(standard);
		legacyBookmarkEvent.set(legacy);

		expect(get(bookmarkEvent)).toBe(standard);
		expect(get(legacyBookmarkEvent)).toBe(legacy);
	});

	it('batches operations queued during publish and updates the UI optimistically', async () => {
		const firstPublish = new Subject<{ ok: boolean }>();
		const secondPublish = new Subject<{ ok: boolean }>();
		mocks.pendingSend = firstPublish;

		const first = bookmark(['e', 'first']);
		await vi.waitFor(() => expect(mocks.sent).toHaveLength(1));

		expect(get(bookmarkEvent)).toBe(mocks.sent[0]);
		expect(mocks.setCalls).toHaveLength(0);

		const second = bookmark(['e', 'second']);
		const third = unbookmark(['e', 'first']);
		const queuedSettled = vi.fn();
		void second.then(queuedSettled, queuedSettled);
		void third.then(queuedSettled, queuedSettled);
		await Promise.resolve();
		expect(queuedSettled).not.toHaveBeenCalled();
		expect(mocks.sent).toHaveLength(1);

		mocks.pendingSend = secondPublish;
		firstPublish.next({ ok: true });
		firstPublish.complete();
		await first;
		await vi.waitFor(() => expect(mocks.sent).toHaveLength(2));
		expect(queuedSettled).not.toHaveBeenCalled();

		secondPublish.next({ ok: true });
		secondPublish.complete();
		await Promise.all([second, third]);
		expect(mocks.sent[1].tags).toEqual([['e', 'second']]);
		expect(queuedSettled).toHaveBeenCalledTimes(2);
	});

	it('aborts queued operations when the active publish fails and recovers for a new write', async () => {
		const previous = event({ id: 'previous', tags: [['e', 'existing']] });
		const firstPublish = new Subject<{ ok: boolean }>();
		mocks.stored = previous;
		mocks.pendingSend = firstPublish;
		bookmarkEvent.set(previous);

		const first = bookmark(['e', 'failed']);
		await vi.waitFor(() => expect(mocks.sent).toHaveLength(1));
		const second = bookmark(['e', 'second']);
		const third = bookmark(['e', 'third']);
		const queuedSettled = vi.fn();
		void second.then(queuedSettled, queuedSettled);
		void third.then(queuedSettled, queuedSettled);
		const secondRejected = expect(second).rejects.toThrow('first rejected');
		const thirdRejected = expect(third).rejects.toThrow('first rejected');
		await Promise.resolve();
		expect(queuedSettled).not.toHaveBeenCalled();
		expect(mocks.sent).toHaveLength(1);

		firstPublish.error(new Error('first rejected'));
		await expect(first).rejects.toThrow('first rejected');
		await Promise.all([secondRejected, thirdRejected]);

		expect(queuedSettled).toHaveBeenCalledTimes(2);
		expect(mocks.sent).toHaveLength(1);
		expect(mocks.setCalls).toHaveLength(0);
		expect(mocks.stored).toBe(previous);
		expect(get(bookmarkEvent)).toBe(previous);

		await bookmark(['e', 'after-abort']);

		expect(mocks.sent).toHaveLength(2);
		expect(mocks.sent[1].tags).toEqual([
			['e', 'existing'],
			['e', 'after-abort']
		]);
		expect(mocks.sent[1].tags).not.toContainEqual(['e', 'failed']);
		expect(mocks.sent[1].tags).not.toContainEqual(['e', 'second']);
		expect(mocks.sent[1].tags).not.toContainEqual(['e', 'third']);
		expect(mocks.stored).toBe(mocks.sent[1]);
		expect(get(bookmarkEvent)).toBe(mocks.sent[1]);
	});

	it('preserves encrypted private content while updating public bookmarks', async () => {
		mocks.stored = event({ content: 'opaque-encrypted-content' });

		await bookmark(['e', 'public']);

		expect(mocks.sent[0].content).toBe('opaque-encrypted-content');
	});

	it('recovers processing and does not save or retain a failed optimistic event', async () => {
		const previous = event({ id: 'previous', tags: [['e', 'existing']] });
		mocks.stored = previous;
		bookmarkEvent.set(previous);
		mocks.sendFails = true;

		await expect(bookmark(['e', 'failed'])).rejects.toThrow('rejected');

		expect(mocks.setCalls).toHaveLength(0);
		expect(mocks.stored).toBe(previous);
		expect(get(bookmarkEvent)).toBe(previous);

		mocks.sendFails = false;
		await bookmark(['e', 'recovered']);

		expect(mocks.sent).toHaveLength(2);
		expect(mocks.sent[1].tags).toEqual([
			['e', 'existing'],
			['e', 'recovered']
		]);
	});

	it('does not overwrite newer local state when a failed publish rolls back', async () => {
		const previous = event({ id: 'previous' });
		const newer = event({ id: 'newer', created_at: 20 });
		const pendingPublish = new Subject<{ ok: boolean }>();
		mocks.stored = previous;
		mocks.pendingSend = pendingPublish;
		bookmarkEvent.set(previous);

		const publishing = bookmark(['e', 'new']);
		await vi.waitFor(() => expect(mocks.sent).toHaveLength(1));
		bookmarkEvent.set(newer);
		pendingPublish.error(new Error('rejected'));

		await expect(publishing).rejects.toThrow('rejected');
		expect(get(bookmarkEvent)).toBe(newer);
		expect(mocks.setCalls).toHaveLength(0);
	});

	it('compares replaceable events by timestamp and then lowest id', () => {
		const older = event({ id: 'aaaa', created_at: 10 });
		const newer = event({ id: 'bbbb', created_at: 20 });
		const lower = event({ id: 'aaaa', created_at: 20 });
		const higher = event({ id: 'bbbb', created_at: 20 });

		expect(isLatestReplaceableEvent(newer, older)).toBe(true);
		expect(isLatestReplaceableEvent(older, newer)).toBe(false);
		expect(isLatestReplaceableEvent(lower, higher)).toBe(true);
		expect(isLatestReplaceableEvent(higher, lower)).toBe(false);
	});

	it('rejects a cached event when the relay has a lower id at the same timestamp', async () => {
		const cached = event({ id: 'bbbb', created_at: 20 });
		mocks.stored = cached;
		mocks.remote = event({ id: 'aaaa', created_at: 20 });
		mocks.mirrorStored = false;
		bookmarkEvent.set(cached);

		await expect(bookmark(['e', 'new'])).rejects.toThrow('Cache is outdated.');

		expect(mocks.sent).toHaveLength(0);
		expect(mocks.setCalls).toHaveLength(0);
		expect(get(bookmarkEvent)).toBe(cached);
	});
});
