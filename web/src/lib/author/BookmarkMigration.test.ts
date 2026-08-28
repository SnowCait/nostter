import { describe, expect, it } from 'vitest';
import { kinds as Kind } from 'nostr-tools';
import { legacyBookmarkIdentifier } from '$lib/Constants';
import {
	filterBookmarkReferences,
	isLegacyBookmarkEvent,
	mergeBookmarkReferences
} from './BookmarkMigration';

const eventId = 'a'.repeat(64);
const otherEventId = 'b'.repeat(64);
const address = `30023:${'c'.repeat(64)}:article`;
const otherAddress = `30023:${'d'.repeat(64)}:other-article`;

describe('isLegacyBookmarkEvent', () => {
	it('accepts kind 30001 with the legacy bookmark identifier', () => {
		expect(
			isLegacyBookmarkEvent({
				kind: Kind.Genericlists,
				tags: [['d', legacyBookmarkIdentifier]]
			})
		).toBe(true);
	});

	it('rejects a different kind', () => {
		expect(
			isLegacyBookmarkEvent({
				kind: Kind.BookmarkList,
				tags: [['d', legacyBookmarkIdentifier]]
			})
		).toBe(false);
	});

	it('rejects a different identifier', () => {
		expect(isLegacyBookmarkEvent({ kind: Kind.Genericlists, tags: [['d', 'other']] })).toBe(
			false
		);
	});
});

describe('filterBookmarkReferences', () => {
	it('keeps valid e and a references and removes list metadata and unrelated tags', () => {
		const eventReference = ['e', eventId, 'wss://relay.example'];
		const addressReference = ['a', address];

		const result = filterBookmarkReferences([
			['d', legacyBookmarkIdentifier],
			['title', 'Bookmarks'],
			['image', 'https://example.com/image.png'],
			['description', 'Saved items'],
			['p', 'e'.repeat(64)],
			eventReference,
			addressReference,
			['r', 'https://example.com']
		]);

		expect(result).toEqual([eventReference, addressReference]);
		expect(result[0]).not.toBe(eventReference);
		expect(result[1]).not.toBe(addressReference);
	});

	it('removes malformed e and a references using the existing validation rules', () => {
		expect(
			filterBookmarkReferences([
				['e', 'not-an-event-id'],
				['e'],
				['a', '30023:not-a-pubkey:article'],
				['a'],
				['e', eventId],
				['a', address]
			])
		).toEqual([
			['e', eventId],
			['a', address]
		]);
	});
});

describe('mergeBookmarkReferences', () => {
	it('preserves existing references and appends only new legacy references', () => {
		const existing = [
			['e', eventId, 'wss://relay.example'],
			['a', address, 'wss://articles.example']
		];
		const legacy = [
			['d', legacyBookmarkIdentifier],
			['e', eventId],
			['a', address],
			['e', otherEventId],
			['a', otherAddress],
			['e', otherEventId]
		];

		expect(mergeBookmarkReferences(existing, legacy)).toEqual([
			['e', eventId, 'wss://relay.example'],
			['a', address, 'wss://articles.example'],
			['e', otherEventId],
			['a', otherAddress]
		]);
	});

	it('does not mutate or reuse the input arrays', () => {
		const existing = [['e', eventId, 'wss://relay.example']];
		const legacy = [['a', address]];
		const originalExisting = structuredClone(existing);
		const originalLegacy = structuredClone(legacy);

		const result = mergeBookmarkReferences(existing, legacy);
		result[0].push('changed');
		result[1].push('changed');

		expect(existing).toEqual(originalExisting);
		expect(legacy).toEqual(originalLegacy);
	});

	it('handles public and decrypted private reference arrays identically', () => {
		const publicReferences = [
			['e', eventId],
			['a', address]
		];
		const decryptedPrivateReferences = structuredClone(publicReferences);

		expect(mergeBookmarkReferences([], publicReferences)).toEqual(
			mergeBookmarkReferences([], decryptedPrivateReferences)
		);
	});
});
