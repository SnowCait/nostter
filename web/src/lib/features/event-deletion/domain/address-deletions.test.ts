import { describe, expect, it } from 'vitest';
import type { Event } from 'nostr-tools';
import { AddressDeletions } from './address-deletions';

const author = 'a'.repeat(64);
const another = 'b'.repeat(64);
const legacyBookmarkAddress = `30001:${author}:bookmark`;

function deletionRequest(created_at: number, tags: string[][], pubkey = author): Event {
	return {
		id: `deletion-${created_at}`,
		kind: 5,
		pubkey,
		created_at,
		tags,
		content: '',
		sig: ''
	};
}

function event(kind: number, created_at: number, tags: string[][] = [], pubkey = author): Event {
	return { id: `event-${created_at}`, kind, pubkey, created_at, tags, content: '', sig: '' };
}

function legacyBookmark(created_at: number): Event {
	return event(30001, created_at, [['d', 'bookmark']]);
}

describe('AddressDeletions', () => {
	it('records a tag deletions of addressable and replaceable events', () => {
		const deletions = new AddressDeletions([
			deletionRequest(10, [
				['a', legacyBookmarkAddress],
				['a', `10003:${author}:`]
			])
		]);

		expect(deletions.isDeleted(legacyBookmark(5))).toBe(true);
		expect(deletions.isDeleted(event(10003, 5))).toBe(true);
		expect(deletions.isDeleted(event(30001, 5, [['d', 'other']]))).toBe(false);
	});

	it('ignores a tags that point to another author', () => {
		const deletions = new AddressDeletions([
			deletionRequest(10, [['a', `30001:${another}:bookmark`]])
		]);

		expect(deletions.isDeleted(event(30001, 5, [['d', 'bookmark']], another))).toBe(false);
	});

	it('ignores malformed addresses and non-replaceable kinds', () => {
		const deletions = new AddressDeletions([
			deletionRequest(10, [
				['a', 'bookmark'],
				['a', `kind:${author}:bookmark`],
				['a', '30001:not-a-pubkey:bookmark'],
				['a'],
				['a', `1:${author}:`]
			])
		]);

		expect(deletions.isDeleted(legacyBookmark(5))).toBe(false);
		expect(deletions.isDeleted(event(1, 5))).toBe(false);
	});

	it('ignores events that are not deletion requests', () => {
		const deletions = new AddressDeletions([
			{ ...deletionRequest(10, [['a', legacyBookmarkAddress]]), kind: 1 }
		]);

		expect(deletions.isDeleted(legacyBookmark(5))).toBe(false);
	});

	it('uses the latest deletion request as the boundary regardless of arrival order', () => {
		const deletions = new AddressDeletions([
			deletionRequest(20, [['a', legacyBookmarkAddress]]),
			deletionRequest(10, [['a', legacyBookmarkAddress]])
		]);

		expect(deletions.isDeleted(legacyBookmark(15))).toBe(true);
		expect(deletions.isDeleted(legacyBookmark(20))).toBe(true);
		expect(deletions.isDeleted(legacyBookmark(21))).toBe(false);
	});

	it('treats events at or before the boundary as deleted and newer events as alive', () => {
		const deletions = new AddressDeletions();
		deletions.add(deletionRequest(10, [['a', legacyBookmarkAddress]]));

		expect(deletions.isDeleted(legacyBookmark(9))).toBe(true);
		expect(deletions.isDeleted(legacyBookmark(10))).toBe(true);
		expect(deletions.isDeleted(legacyBookmark(11))).toBe(false);
	});
});
