import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import { get } from 'svelte/store';

const mocks = vi.hoisted(() => ({
	cachedEvent: undefined as Nostr.Event | undefined,
	sentEvents: [] as Nostr.Event[],
	privateContent: new Map<string, string>(),
	signEvent: vi.fn(
		async (event: Nostr.UnsignedEvent): Promise<Nostr.Event> => ({
			...event,
			id: `signed-${mocks.sentEvents.length}`,
			pubkey: 'author',
			sig: 'sig'
		})
	),
	decrypt: vi.fn(async (_pubkey: string, content: string) => {
		const plaintext = mocks.privateContent.get(content);
		if (plaintext === undefined) {
			throw new Error('decrypt failed');
		}
		return plaintext;
	}),
	decryptNip44: vi.fn(async (_pubkey: string, content: string) => {
		const plaintext = mocks.privateContent.get(content);
		if (plaintext === undefined) {
			throw new Error('decrypt failed');
		}
		return plaintext;
	}),
	encryptNip44: vi.fn(async (_pubkey: string, plaintext: string) => `nip44:${plaintext}`),
	setReplaceableEvent: vi.fn()
}));

vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: {
		send: (event: Nostr.Event) => {
			mocks.sentEvents.push(event);
			return of({ ok: true });
		}
	}
}));
vi.mock('$lib/Signer', () => ({
	Signer: {
		signEvent: mocks.signEvent,
		decrypt: mocks.decrypt,
		decryptNip44: mocks.decryptNip44,
		encryptNip44: mocks.encryptNip44
	}
}));
vi.mock('$lib/RxNostrHelper', () => ({
	fetchLastEvent: vi.fn(async () => mocks.cachedEvent)
}));
vi.mock('$lib/WebStorage', () => ({
	WebStorage: class {
		getReplaceableEvent() {
			return mocks.cachedEvent;
		}

		setReplaceableEvent(event: Nostr.Event) {
			mocks.cachedEvent = event;
			mocks.setReplaceableEvent(event);
		}
	}
}));
vi.stubGlobal('localStorage', {});

import {
	bookmark,
	bookmarkEvent,
	copyLegacyBookmarks,
	legacyBookmarkEvent,
	updateBookmarkTags
} from './Bookmark';

const standardPublic = '1'.repeat(64);
const oldPublic = '2'.repeat(64);
const normalPublic = '3'.repeat(64);
const standardPrivate = '4'.repeat(64);
const oldPrivate = '5'.repeat(64);
const address = `30023:${'6'.repeat(64)}:article`;

function event(
	kind: number,
	tags: string[][],
	content: string,
	id: string,
	createdAt: number = 10
): Nostr.Event {
	return {
		id,
		pubkey: 'author',
		created_at: createdAt,
		kind,
		tags,
		content,
		sig: 'sig'
	};
}

function oldFormatEvent(content: string = ''): Nostr.Event {
	return event(
		Kind.Genericlists,
		[
			['d', 'bookmark'],
			['title', 'Old bookmarks'],
			['e', oldPublic],
			['a', address],
			['e', oldPublic],
			['p', 'not-a-bookmark']
		],
		content,
		'old-format'
	);
}

function decryptedTags(content: string): string[][] {
	return JSON.parse(content.replace('nip44:', ''));
}

describe('Bookmark', () => {
	beforeEach(() => {
		mocks.cachedEvent = undefined;
		mocks.sentEvents = [];
		mocks.privateContent.clear();
		vi.clearAllMocks();
		bookmarkEvent.set(undefined);
		legacyBookmarkEvent.set(undefined);
	});

	it('publishes updates as the standard NIP-51 bookmark kind', async () => {
		await bookmark(['e', 'event-id']);

		expect(mocks.signEvent).toHaveBeenCalledWith(
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

	it('creates a standard event and copies valid public and private references', async () => {
		const old = oldFormatEvent('old-private?iv=value');
		mocks.privateContent.set(
			old.content,
			JSON.stringify([
				['e', oldPrivate],
				['a', address],
				['e', oldPrivate],
				['p', 'not-a-bookmark']
			])
		);
		const oldSnapshot = structuredClone(old);

		await copyLegacyBookmarks(old);

		expect(mocks.sentEvents).toHaveLength(1);
		const published = mocks.sentEvents[0];
		expect(published.kind).toBe(Kind.BookmarkList);
		expect(published.tags).toEqual([
			['e', oldPublic],
			['a', address]
		]);
		expect(decryptedTags(published.content)).toEqual([
			['e', oldPrivate],
			['a', address]
		]);
		expect(mocks.encryptNip44).toHaveBeenCalled();
		expect(published.tags).not.toContainEqual(['d', 'bookmark']);
		expect(published.tags).not.toContainEqual(['title', 'Old bookmarks']);
		expect(old).toEqual(oldSnapshot);
		expect(get(bookmarkEvent)).toBe(published);
		expect(mocks.cachedEvent).toBe(published);
	});

	it('merges with existing standard public and private references without duplicates', async () => {
		mocks.cachedEvent = event(
			Kind.BookmarkList,
			[
				['e', standardPublic],
				['e', oldPublic, 'wss://relay.example'],
				['client', 'nostter']
			],
			'standard-private',
			'standard'
		);
		mocks.privateContent.set(
			'standard-private',
			JSON.stringify([
				['e', standardPrivate],
				['e', oldPrivate],
				['custom', 'keep-me']
			])
		);
		const old = oldFormatEvent('old-private');
		mocks.privateContent.set(
			'old-private',
			JSON.stringify([
				['e', oldPrivate, 'wss://relay.example'],
				['a', address]
			])
		);

		await copyLegacyBookmarks(old);

		const published = mocks.sentEvents[0];
		expect(published.tags).toEqual([
			['e', standardPublic],
			['e', oldPublic, 'wss://relay.example'],
			['client', 'nostter'],
			['a', address]
		]);
		expect(decryptedTags(published.content)).toEqual([
			['e', standardPrivate],
			['e', oldPrivate],
			['custom', 'keep-me'],
			['a', address]
		]);
	});

	it.each([
		['decrypt failure', 'missing-content'],
		['parse failure', 'invalid-json']
	])('publishes nothing on private %s', async (_name, content) => {
		const standard = event(
			Kind.BookmarkList,
			[['e', standardPublic]],
			'standard-private',
			'standard'
		);
		mocks.cachedEvent = standard;
		mocks.privateContent.set('standard-private', JSON.stringify([['e', standardPrivate]]));
		if (content === 'invalid-json') {
			mocks.privateContent.set(content, '{invalid');
		}
		bookmarkEvent.set(standard);
		const old = oldFormatEvent(content);

		await expect(copyLegacyBookmarks(old)).rejects.toBeInstanceOf(Error);

		expect(mocks.signEvent).not.toHaveBeenCalled();
		expect(mocks.sentEvents).toEqual([]);
		expect(mocks.setReplaceableEvent).not.toHaveBeenCalled();
		expect(mocks.cachedEvent).toBe(standard);
		expect(get(bookmarkEvent)).toBe(standard);
	});

	it('serializes copy with a normal bookmark write without losing either update', async () => {
		mocks.cachedEvent = event(Kind.BookmarkList, [['e', standardPublic]], '', 'standard');
		const old = oldFormatEvent();

		const normalWrite = bookmark(['e', normalPublic]);
		const copy = copyLegacyBookmarks(old);
		await Promise.all([normalWrite, copy]);

		expect(mocks.sentEvents.length).toBeGreaterThanOrEqual(1);
		const published = mocks.sentEvents.at(-1);
		expect(published?.tags).toEqual(
			expect.arrayContaining([
				['e', standardPublic],
				['e', normalPublic],
				['e', oldPublic],
				['a', address]
			])
		);
		expect(mocks.cachedEvent).toBe(published);
		expect(get(bookmarkEvent)).toBe(published);
	});
});
