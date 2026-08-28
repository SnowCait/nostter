import { get } from 'svelte/store';
import { of, Subject, throwError, type Observable } from 'rxjs';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	cached: undefined as Nostr.Event | undefined,
	remote: undefined as Nostr.Event | undefined,
	remoteEvents: [] as Array<Nostr.Event | undefined>,
	mirrorCache: true,
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
	fetchLastEvent: vi.fn(async () => {
		if (mocks.remoteEvents.length > 0) return mocks.remoteEvents.shift();
		return mocks.mirrorCache ? mocks.cached : mocks.remote;
	})
}));
vi.mock('$lib/stores/Author', async () => {
	const { writable } = await import('svelte/store');
	return { pubkey: writable('pubkey') };
});
vi.mock('$lib/WebStorage', () => ({
	WebStorage: class {
		getReplaceableEvent() {
			return mocks.cached;
		}

		setReplaceableEvent(event: Nostr.Event) {
			mocks.setCalls.push(event);
			mocks.cached = event;
		}
	}
}));
vi.stubGlobal('localStorage', {});

import {
	bookmark,
	bookmarkEvent,
	latestEvent,
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
		mocks.cached = undefined;
		mocks.remote = undefined;
		mocks.remoteEvents = [];
		mocks.mirrorCache = true;
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

	it('preserves encrypted private content when adding a public bookmark', async () => {
		mocks.cached = event({ content: 'opaque-encrypted-content' });

		await bookmark(['e', 'new']);

		expect(mocks.sent[0].content).toBe('opaque-encrypted-content');
	});

	it('preserves encrypted private content when removing a public bookmark', async () => {
		mocks.cached = event({
			content: 'opaque-encrypted-content',
			tags: [['e', 'remove']]
		});

		await unbookmark(['e', 'remove']);

		expect(mocks.sent[0].content).toBe('opaque-encrypted-content');
	});

	it('serializes concurrent writes without losing either change', async () => {
		const firstPublish = new Subject<{ ok: boolean }>();
		mocks.pendingSend = firstPublish;

		const first = bookmark(['e', 'first']);
		await vi.waitFor(() => expect(mocks.sent).toHaveLength(1));
		const second = bookmark(['e', 'second']);
		await Promise.resolve();
		expect(mocks.sent).toHaveLength(1);

		firstPublish.next({ ok: true });
		firstPublish.complete();
		await Promise.all([first, second]);

		expect(mocks.sent[1].tags).toEqual([
			['e', 'first'],
			['e', 'second']
		]);
	});

	it('uses a newer relay event instead of a stale local snapshot', async () => {
		mocks.cached = event({ id: 'local', created_at: 10, tags: [['e', 'local']] });
		mocks.remote = event({ id: 'remote', created_at: 20, tags: [['e', 'remote']] });
		mocks.mirrorCache = false;

		await bookmark(['e', 'new']);

		expect(mocks.sent[0].tags).toEqual([
			['e', 'remote'],
			['e', 'new']
		]);
	});

	it('restarts a write when a newer relay event is observed before signing', async () => {
		const original = event({ id: 'original', created_at: 10, tags: [['e', 'original']] });
		const newer = event({ id: 'newer', created_at: 20, tags: [['e', 'newer']] });
		mocks.cached = original;
		mocks.remoteEvents = [original, newer, newer, newer];

		await bookmark(['e', 'added']);

		expect(mocks.sent).toHaveLength(1);
		expect(mocks.sent[0].tags).toEqual([
			['e', 'newer'],
			['e', 'added']
		]);
	});

	it('selects the lexicographically lower id when replaceable timestamps match', () => {
		const higher = event({ id: 'bbbb', created_at: 20 });
		const lower = event({ id: 'aaaa', created_at: 20 });

		expect(latestEvent(higher, lower)).toBe(lower);
		expect(latestEvent(lower, higher)).toBe(lower);
	});

	it('does not change local state or cache when relay publish fails', async () => {
		const previous = event({ id: 'previous', tags: [['e', 'existing']] });
		mocks.cached = previous;
		bookmarkEvent.set(previous);
		mocks.sendFails = true;

		await expect(bookmark(['e', 'new'])).rejects.toThrow('rejected');

		expect(get(bookmarkEvent)).toBe(previous);
		expect(mocks.cached).toBe(previous);
		expect(mocks.setCalls).toHaveLength(0);
	});
});
