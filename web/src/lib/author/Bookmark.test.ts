import { get } from 'svelte/store';
import { of, throwError } from 'rxjs';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	stored: undefined as Nostr.Event | undefined,
	sendFails: false,
	sent: [] as Nostr.Event[],
	privateByContent: new Map<string, string[][]>(),
	signCount: 0,
	deleteAddressableEvent: vi.fn(),
	removedLegacyCache: false
}));

vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: {
		send: (event: Nostr.Event) => {
			mocks.sent.push(event);
			return mocks.sendFails ? throwError(() => new Error('rejected')) : of({ ok: true });
		}
	}
}));
vi.mock('$lib/Signer', () => ({
	Signer: {
		signEvent: vi.fn(async (event) => ({
			...event,
			id: `signed-${++mocks.signCount}`,
			pubkey: 'pubkey',
			sig: 'sig'
		}))
	}
}));
vi.mock('$lib/List', () => ({
	decryptListContent: vi.fn(async (_pubkey: string, content: string) => [
		mocks.privateByContent.get(content) ?? [],
		content.startsWith('nip04:')
	]),
	encryptListContent: vi.fn(
		async (tags: string[][], legacy = false) =>
			`${legacy ? 'nip04' : 'nip44'}:${JSON.stringify(tags)}`
	)
}));
vi.mock('$lib/RxNostrHelper', () => ({
	fetchLastEvent: vi.fn(async () => mocks.stored)
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
			mocks.stored = event;
		}
		removeParameterizedReplaceableEvent() {
			mocks.removedLegacyCache = true;
		}
	}
}));
vi.mock('./Delete', () => ({ deleteAddressableEvent: mocks.deleteAddressableEvent }));
vi.stubGlobal('localStorage', {});

import {
	bookmark,
	bookmarkEvent,
	copyLegacyBookmarks,
	deleteLegacyBookmarks,
	legacyBookmarkEvent,
	mergeBookmarkReferences,
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
		mocks.sendFails = false;
		mocks.sent = [];
		mocks.privateByContent.clear();
		mocks.signCount = 0;
		mocks.removedLegacyCache = false;
		mocks.deleteAddressableEvent.mockReset();
		bookmarkEvent.set(undefined);
		legacyBookmarkEvent.set(undefined);
	});

	it('adds and removes e/a references without duplicating them', () => {
		const added = updateBookmarkTags([], { type: 'bookmark', tag: ['a', '30023:p:d'] });
		expect(updateBookmarkTags(added, { type: 'bookmark', tag: ['a', '30023:p:d'] })).toEqual(
			added
		);
		expect(updateBookmarkTags(added, { type: 'unbookmark', tag: ['a', '30023:p:d'] })).toEqual(
			[]
		);
	});

	it('merges only bookmark references and preserves destination tags', () => {
		expect(
			mergeBookmarkReferences(
				[
					['e', 'existing'],
					['client', 'nostter']
				],
				[
					['e', 'existing'],
					['a', '30023:p:d'],
					['p', 'unsupported']
				]
			)
		).toEqual([
			['e', 'existing'],
			['client', 'nostter'],
			['a', '30023:p:d']
		]);
	});

	it('copies public and NIP-04 private bookmarks into NIP-44 without changing legacy state', async () => {
		mocks.stored = event({
			id: 'standard',
			tags: [
				['e', 'existing'],
				['client', 'nostter']
			],
			content: 'standard-private'
		});
		mocks.privateByContent.set('standard-private', [
			['a', 'existing-private'],
			['x', 'keep-private']
		]);
		const legacy = event({
			id: 'legacy',
			kind: Kind.Genericlists,
			tags: [
				['d', 'bookmark'],
				['e', 'existing'],
				['a', 'public-new']
			],
			content: 'nip04:legacy-private'
		});
		mocks.privateByContent.set('nip04:legacy-private', [
			['a', 'existing-private'],
			['e', 'private-new'],
			['p', 'unsupported']
		]);
		legacyBookmarkEvent.set(legacy);

		const copied = await copyLegacyBookmarks();

		expect(copied.tags).toEqual([
			['e', 'existing'],
			['client', 'nostter'],
			['a', 'public-new']
		]);
		expect(copied.content).toBe(
			'nip44:[["a","existing-private"],["x","keep-private"],["e","private-new"]]'
		);
		expect(get(bookmarkEvent)).toBe(copied);
		expect(get(legacyBookmarkEvent)).toBe(legacy);
		expect(mocks.sent).toHaveLength(1);
	});

	it('uses the newer relay event instead of a stale local bookmark snapshot', async () => {
		mocks.stored = event({ id: 'relay-newer', created_at: 20, tags: [['e', 'remote']] });
		legacyBookmarkEvent.set(event({ kind: Kind.Genericlists, tags: [['e', 'legacy']] }));

		const copied = await copyLegacyBookmarks();

		expect(copied.tags).toEqual([
			['e', 'remote'],
			['e', 'legacy']
		]);
	});

	it('serializes normal bookmark writes with bulk copy without losing either change', async () => {
		legacyBookmarkEvent.set(event({ kind: Kind.Genericlists, tags: [['e', 'legacy']] }));

		await Promise.all([bookmark(['e', 'normal']), copyLegacyBookmarks()]);

		expect(mocks.stored?.tags).toEqual([
			['e', 'normal'],
			['e', 'legacy']
		]);
		expect(mocks.sent).toHaveLength(2);
	});

	it('does not update standard or legacy local state when publish fails', async () => {
		const standard = event({ id: 'standard', tags: [['e', 'existing']] });
		const legacy = event({ id: 'legacy', kind: Kind.Genericlists, tags: [['e', 'legacy']] });
		mocks.stored = standard;
		bookmarkEvent.set(standard);
		legacyBookmarkEvent.set(legacy);
		mocks.sendFails = true;

		await expect(copyLegacyBookmarks()).rejects.toThrow();
		expect(get(bookmarkEvent)).toBe(standard);
		expect(get(legacyBookmarkEvent)).toBe(legacy);
		expect(mocks.stored).toBe(standard);
	});

	it('hides and clears only old-format local state after deletion publish succeeds', async () => {
		const standard = event({ id: 'standard' });
		const legacy = event({ id: 'legacy', kind: Kind.Genericlists });
		bookmarkEvent.set(standard);
		legacyBookmarkEvent.set(legacy);
		mocks.deleteAddressableEvent.mockResolvedValue(event({ kind: 5 }));

		await deleteLegacyBookmarks();

		expect(mocks.deleteAddressableEvent).toHaveBeenCalledWith(30001, 'pubkey', 'bookmark');
		expect(mocks.removedLegacyCache).toBe(true);
		expect(get(legacyBookmarkEvent)).toBeUndefined();
		expect(get(bookmarkEvent)).toBe(standard);
		expect(mocks.sent).toHaveLength(0);
	});

	it('retains old-format local state when deletion publish fails', async () => {
		const legacy = event({ id: 'legacy', kind: Kind.Genericlists });
		legacyBookmarkEvent.set(legacy);
		mocks.deleteAddressableEvent.mockRejectedValue(new Error('rejected'));

		await expect(deleteLegacyBookmarks()).rejects.toThrow('rejected');

		expect(mocks.removedLegacyCache).toBe(false);
		expect(get(legacyBookmarkEvent)).toBe(legacy);
	});
});
