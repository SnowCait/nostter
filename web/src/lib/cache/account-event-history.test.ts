import 'fake-indexeddb/auto';
import { afterAll, describe, expect, it } from 'vitest';
import type * as Nostr from 'nostr-typedef';
import { db } from './db';
import { cacheAccountEvent } from './Events';

function event(kind: number, created_at: number, tags: string[][] = []): Nostr.Event {
	return {
		id: `${kind}-${created_at}`,
		kind,
		pubkey: 'a'.repeat(64),
		created_at,
		tags,
		content: '',
		sig: 'sig'
	};
}

afterAll(async () => {
	await db.delete();
});

describe('account event history', () => {
	it('preserves generic history for accepted normal replaceable events only', async () => {
		const older = event(3, 1);
		const newer = event(3, 2);
		const stale = event(3, 0);
		const addressable = event(30007, 1, [['d', '6']]);
		expect(await cacheAccountEvent(older)).toBe(true);
		expect(await cacheAccountEvent(newer)).toBe(true);
		expect(await cacheAccountEvent(stale)).toBe(false);
		expect(await cacheAccountEvent(addressable)).toBe(true);
		expect(await db.events.get(older.id)).toEqual(older);
		expect(await db.events.get(newer.id)).toEqual(newer);
		expect(await db.events.get(stale.id)).toBeUndefined();
		expect(await db.events.get(addressable.id)).toBeUndefined();
	});
});
