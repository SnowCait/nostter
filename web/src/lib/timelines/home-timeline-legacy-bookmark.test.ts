import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { get } from 'svelte/store';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';

const mocks = vi.hoisted(() => ({
	pubkey: '',
	use: vi.fn(),
	cacheAccountEvent: vi.fn()
}));
vi.mock('rx-nostr', async (importOriginal) => ({
	...(await importOriginal<typeof import('rx-nostr')>()),
	createRxForwardReq: () => ({ emit: vi.fn() })
}));
vi.mock('./MainTimeline', () => ({
	rxNostr: { use: mocks.use },
	tie: <T>(source: T): T => source,
	referencesReqEmit: vi.fn(),
	storeSeenOn: vi.fn()
}));
vi.mock('$lib/UserStatus', () => ({ updateUserStatus: vi.fn(), userStatusReqEmit: vi.fn() }));
vi.mock('$lib/author/Action', () => ({
	authorActionReqEmit: vi.fn(),
	updateReactionedEvents: vi.fn(),
	updateRepostedEvents: vi.fn()
}));
vi.mock('$lib/cache/Events', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/cache/Events')>()),
	cacheAccountEvent: mocks.cacheAccountEvent
}));
vi.mock('$lib/auth.svelte', () => ({
	auth: {
		get pubkey() {
			return mocks.pubkey;
		},
		get followees() {
			return [mocks.pubkey];
		},
		signer: undefined
	}
}));

import { HomeTimeline } from './HomeTimeline';
import { bookmarkEvent, legacyBookmarkEvent } from '$lib/author/Bookmark.svelte';
import { markEventsDeleted } from '$lib/features/event-deletion/application/deletion-state';

type Packet = { event: Nostr.Event; from: string };

function event(kind: number, created_at: number, tags: string[][] = []): Nostr.Event {
	return {
		id: `${kind}-${created_at}`,
		pubkey: mocks.pubkey,
		kind,
		created_at,
		tags,
		content: '',
		sig: ''
	};
}

function legacyBookmark(created_at: number): Nostr.Event {
	return event(Kind.Genericlists, created_at, [
		['d', 'bookmark'],
		['e', `legacy-${created_at}`]
	]);
}

let packets: Subject<Packet>;
let deletionRequest: Nostr.Event;
let standardBookmark: Nostr.Event;
let accountCount = 0;

function receive(event: Nostr.Event): void {
	packets.next({ event, from: 'wss://relay.example' });
}

beforeEach(() => {
	// Deletion state outlives each test, so every test uses a fresh account.
	mocks.pubkey = (++accountCount).toString(16).padStart(64, '0');
	deletionRequest = event(Kind.EventDeletion, 10, [
		['a', `${Kind.Genericlists}:${mocks.pubkey}:bookmark`]
	]);
	standardBookmark = event(Kind.BookmarkList, 1, [['e', 'standard']]);
	packets = new Subject<Packet>();
	mocks.use.mockReturnValue(packets);
	mocks.cacheAccountEvent.mockReset().mockResolvedValue(true);
	bookmarkEvent.set(standardBookmark);
	legacyBookmarkEvent.set(undefined);
	new HomeTimeline().subscribe();
});

describe('HomeTimeline legacy bookmark deletion', () => {
	it('neither caches nor applies a re-received legacy bookmark covered by a known deletion request', async () => {
		markEventsDeleted(deletionRequest);

		receive(legacyBookmark(10));
		const standardUpdate = event(Kind.BookmarkList, 2, [['e', 'updated']]);
		receive(standardUpdate);
		await vi.waitFor(() => expect(get(bookmarkEvent)).toEqual(standardUpdate));

		expect(mocks.cacheAccountEvent).not.toHaveBeenCalledWith(legacyBookmark(10));
		expect(get(legacyBookmarkEvent)).toBeUndefined();
	});

	it('removes the displayed legacy bookmark when its deletion request arrives', async () => {
		receive(legacyBookmark(5));
		await vi.waitFor(() => expect(get(legacyBookmarkEvent)).toEqual(legacyBookmark(5)));

		receive(deletionRequest);

		expect(get(legacyBookmarkEvent)).toBeUndefined();
		expect(get(bookmarkEvent)).toEqual(standardBookmark);
	});

	it('does not apply a legacy bookmark whose deletion request arrives while it is being cached', async () => {
		const write = Promise.withResolvers<boolean>();
		mocks.cacheAccountEvent.mockReturnValueOnce(write.promise);

		receive(legacyBookmark(7));
		receive(deletionRequest);
		write.resolve(true);
		await write.promise;
		await Promise.resolve();

		expect(get(legacyBookmarkEvent)).toBeUndefined();
	});

	it('applies a legacy bookmark published after the deletion request', async () => {
		markEventsDeleted(deletionRequest);

		receive(legacyBookmark(11));

		await vi.waitFor(() => expect(get(legacyBookmarkEvent)).toEqual(legacyBookmark(11)));
		expect(mocks.cacheAccountEvent).toHaveBeenCalledWith(legacyBookmark(11));
	});
});
