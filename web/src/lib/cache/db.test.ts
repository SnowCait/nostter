import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { EventCache, type CacheDB } from './db';
import type { Event } from 'nostr-typedef';

const mockEvent = (overrides: Partial<Event> = {}): Event => ({
	id: '0'.repeat(64),
	kind: 1,
	pubkey: 'a'.repeat(64),
	created_at: 1234567890,
	tags: [],
	content: '',
	sig: 'b'.repeat(128),
	...overrides
});

describe('EventCache', () => {
	let testDb: CacheDB;
	let cache: EventCache;

	beforeEach(async () => {
		testDb = new Dexie(`cache-test-${Date.now()}`) as CacheDB;
		testDb.version(1).stores({
			events: 'id, kind, pubkey, created_at, [kind+pubkey]'
		});
		await testDb.open();

		cache = new EventCache(testDb);
	});

	afterEach(async () => {
		await testDb.delete();
	});

	describe('addIfNotExists', () => {
		it('should add a new event', async () => {
			const event = mockEvent({ id: '1'.repeat(64) });
			await cache.addIfNotExists(event);

			const stored = await testDb.events.get(event.id);
			expect(stored).toBeDefined();
			expect(stored?.id).toBe(event.id);
		});

		it('should not add duplicate event with same id', async () => {
			const event = mockEvent({ id: '2'.repeat(64) });

			await cache.addIfNotExists(event);

			const modifiedEvent = { ...event, content: 'modified' };
			await cache.addIfNotExists(modifiedEvent);

			const stored = await testDb.events.get(event.id);
			expect(stored?.content).toBe('');
		});

		it('should add multiple different events', async () => {
			const event1 = mockEvent({ id: '3'.repeat(64) });
			const event2 = mockEvent({ id: '4'.repeat(64) });

			await cache.addIfNotExists(event1);
			await cache.addIfNotExists(event2);

			const count = await testDb.events.count();
			expect(count).toBe(2);
		});
	});

	describe('getReplaceableEvents', () => {
		beforeEach(async () => {
			const pubkey1 = 'a'.repeat(64);
			const pubkey2 = 'b'.repeat(64);

			await testDb.events.bulkAdd([
				mockEvent({ id: '1'.repeat(64), kind: 0, pubkey: pubkey1, created_at: 1000 }),
				mockEvent({ id: '2'.repeat(64), kind: 0, pubkey: pubkey1, created_at: 2000 }),
				mockEvent({ id: '3'.repeat(64), kind: 0, pubkey: pubkey2, created_at: 1500 }),
				mockEvent({ id: '4'.repeat(64), kind: 1, pubkey: pubkey1, created_at: 3000 }),
				mockEvent({ id: '5'.repeat(64), kind: 1, pubkey: pubkey2, created_at: 2500 })
			]);
		});

		it('should retrieve events by kind and pubkey', async () => {
			const pubkey = 'a'.repeat(64);
			const events = await cache.getReplaceableEvents(0, pubkey);

			expect(events.length).toBe(2);
			expect(events.every((e) => e.kind === 0 && e.pubkey === pubkey)).toBe(true);
		});

		it('should retrieve events with different kind', async () => {
			const pubkey = 'a'.repeat(64);
			const events = await cache.getReplaceableEvents(1, pubkey);

			expect(events.length).toBe(1);
			expect(events[0].kind).toBe(1);
		});

		it('should return empty array when no events exist', async () => {
			const pubkey = 'c'.repeat(64);
			const events = await cache.getReplaceableEvents(0, pubkey);

			expect(events).toStrictEqual([]);
		});

		it('should return empty array for non-existent kind and pubkey', async () => {
			const pubkey = 'a'.repeat(64);
			const events = await cache.getReplaceableEvents(999, pubkey);

			expect(events).toStrictEqual([]);
		});

		it('should sort events by created_at in descending order', async () => {
			const pubkey = 'a'.repeat(64);
			const events = await cache.getReplaceableEvents(0, pubkey);

			expect(events.length).toBe(2);
			expect(events[0].created_at).toBe(2000);
			expect(events[1].created_at).toBe(1000);
		});
	});
});
