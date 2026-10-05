import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import type * as Nostr from 'nostr-typedef';
import { deletedEventIdsByPubkey, isDeletedByAddress, markEventsDeleted } from './deletion-state';

function deletionRequest(
	id: string,
	pubkey: string,
	tags: string[][] = [],
	created_at = 1
): Nostr.Event {
	return { id, kind: 5, pubkey, content: '', tags, created_at, sig: 'sig' };
}

beforeEach(() => {
	deletedEventIdsByPubkey.set(new Map());
});

describe('markEventsDeleted', () => {
	it('records e tag event IDs per request author pubkey', () => {
		const pubkey = 'a'.repeat(64);
		markEventsDeleted(
			deletionRequest('d1', pubkey, [
				['e', 'id1'],
				['e', 'id2']
			])
		);

		expect(get(deletedEventIdsByPubkey).get(pubkey)).toEqual(new Set(['id1', 'id2']));
	});

	it('adds IDs from multiple requests while preserving existing ones', () => {
		const pubkey = 'a'.repeat(64);
		markEventsDeleted(deletionRequest('d1', pubkey, [['e', 'id1']]));
		markEventsDeleted(deletionRequest('d2', pubkey, [['e', 'id2']]));

		expect(get(deletedEventIdsByPubkey).get(pubkey)).toEqual(new Set(['id1', 'id2']));
	});

	it('does not change state when the event has no e tags', () => {
		const pubkey = 'a'.repeat(64);
		markEventsDeleted(deletionRequest('d1', pubkey, [['p', 'x']]));

		expect(get(deletedEventIdsByPubkey).size).toBe(0);
	});

	it('records a tag deletions alongside e tag deletions', () => {
		const pubkey = 'c'.repeat(64);
		const legacyBookmark: Nostr.Event = {
			id: 'legacy',
			kind: 30001,
			pubkey,
			content: '',
			tags: [['d', 'bookmark']],
			created_at: 10,
			sig: 'sig'
		};
		markEventsDeleted(
			deletionRequest(
				'd1',
				pubkey,
				[
					['e', 'id1'],
					['a', `30001:${pubkey}:bookmark`]
				],
				10
			)
		);

		expect(get(deletedEventIdsByPubkey).get(pubkey)).toEqual(new Set(['id1']));
		expect(isDeletedByAddress(legacyBookmark)).toBe(true);
		expect(isDeletedByAddress({ ...legacyBookmark, created_at: 11 })).toBe(false);
	});
});
