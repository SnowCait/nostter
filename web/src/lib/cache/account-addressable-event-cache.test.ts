import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import type * as Nostr from 'nostr-typedef';
import { AccountAddressableEventCache, type CacheDB } from './db';

const a = 'a'.repeat(64);
const b = 'b'.repeat(64);
let id = 0;
function event(pubkey: string, kind: number, created_at: number, identifier?: string): Nostr.Event {
	return {
		id: String(++id).padStart(64, '0'),
		pubkey,
		kind,
		created_at,
		tags: identifier === undefined ? [] : [['d', identifier]],
		content: '',
		sig: 's'.repeat(128)
	};
}

describe('AccountAddressableEventCache', () => {
	let testDb: CacheDB;
	let cache: AccountAddressableEventCache;
	beforeEach(async () => {
		testDb = new Dexie(`account-addressable-${crypto.randomUUID()}`) as CacheDB;
		testDb.version(1).stores({
			events: 'id, kind, pubkey, [kind+pubkey]',
			followeeReplaceableEvents: '[kind+pubkey], pubkey',
			accountAddressableEvents: '[pubkey+kind+identifier]'
		});
		await testDb.open();
		cache = new AccountAddressableEventCache(testDb);
	});
	afterEach(async () => {
		await testDb.delete();
	});

	it('separates normal replaceable entries by pubkey and normalizes the identifier', async () => {
		const a1 = event(a, 10000, 1, 'ignored');
		const b1 = event(b, 10000, 1);
		const a2 = event(a, 10000, 2);
		expect(await cache.put(a1)).toBe(true);
		expect(await cache.put(b1)).toBe(true);
		expect(await cache.get(a, 10000, '')).toEqual(a1);
		expect(await cache.get(b, 10000, '')).toEqual(b1);
		await cache.put(a2);
		expect(await cache.get(a, 10000)).toEqual(a2);
		expect(await cache.get(b, 10000)).toEqual(b1);
		expect((await testDb.accountAddressableEvents.get([a, 10000, '']))?.identifier).toBe('');
	});

	it('separates addressable identifiers and accounts and removes one exact address', async () => {
		const a6 = event(a, 30007, 1, '6');
		const a7 = event(a, 30007, 1, '7');
		const b6 = event(b, 30007, 1, '6');
		await Promise.all([cache.put(a6), cache.put(a7), cache.put(b6)]);
		expect(await cache.get(a, 30007, '6')).toEqual(a6);
		expect(await cache.get(a, 30007, '7')).toEqual(a7);
		expect(await cache.get(b, 30007, '6')).toEqual(b6);
		await cache.remove(a, 30007, '6');
		expect(await cache.get(a, 30007, '6')).toBeUndefined();
		expect(await cache.get(a, 30007, '7')).toEqual(a7);
		expect(await cache.get(b, 30007, '6')).toEqual(b6);
	});

	it('uses existing d-tag semantics, including a missing or empty d tag', async () => {
		const missing = event(a, 30007, 1);
		const empty = event(a, 30007, 2, '');
		const first = event(a, 30007, 3, 'first');
		first.tags.push(['d', 'second']);
		await cache.put(missing);
		await cache.put(empty);
		await cache.put(first);
		expect(await cache.get(a, 30007, '')).toEqual(empty);
		expect(await cache.get(a, 30007, 'first')).toEqual(first);
		expect(await cache.get(a, 30007, 'second')).toBeUndefined();
	});

	it('serializes read, compare and write for concurrent candidates and preserves strict newer semantics', async () => {
		const older = event(a, 3, 1);
		const newer = event(a, 3, 2);
		const equal = event(a, 3, 2);
		const results = await Promise.all([cache.put(newer), cache.put(older)]);
		expect(results).toEqual([true, false]);
		expect(await cache.put(equal)).toBe(false);
		expect(await cache.get(a, 3)).toEqual(newer);
		await cache.remove(a, 3);
		const reverseResults = await Promise.all([cache.put(older), cache.put(newer)]);
		expect(reverseResults).toEqual([true, true]);
		expect(await cache.get(a, 3)).toEqual(newer);
	});

	it('keeps B unchanged when a delayed A write completes after B', async () => {
		const aEvent = event(a, 10000, 1);
		const bEvent = event(b, 10000, 1);
		const release = Promise.withResolvers<void>();
		const delayedA = release.promise.then(() => cache.put(aEvent));
		await cache.put(bEvent);
		release.resolve();
		await delayedA;
		expect(await cache.get(b, 10000)).toEqual(bEvent);
	});

	it('rejects events without replaceable addresses', async () => {
		await expect(cache.put(event(a, 1, 1))).rejects.toThrow('replaceable address');
		expect(await testDb.accountAddressableEvents.count()).toBe(0);
	});

	it('clears only accountAddressableEvents', async () => {
		const current = event(a, 3, 1);
		await cache.put(current);
		await testDb.events.put(current);
		await testDb.followeeReplaceableEvents.put(current);
		await cache.clear();
		expect(await testDb.accountAddressableEvents.count()).toBe(0);
		expect(await testDb.events.get(current.id)).toEqual(current);
		expect(await testDb.followeeReplaceableEvents.get([3, a])).toEqual(current);
	});
});
