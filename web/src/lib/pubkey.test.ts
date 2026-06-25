import { describe, expect, it } from 'vitest';
import { isValidPubkey, pubkeysFromTags } from './pubkey';

const a = 'a'.repeat(64);
const b = 'b'.repeat(64);

describe('isValidPubkey', () => {
	it('accepts 64-char lowercase hex', () => {
		expect(isValidPubkey(a)).toBe(true);
		expect(isValidPubkey('0123456789abcdef'.repeat(4))).toBe(true);
	});

	it('rejects invalid values', () => {
		expect(isValidPubkey('a'.repeat(63))).toBe(false);
		expect(isValidPubkey('a'.repeat(65))).toBe(false);
		expect(isValidPubkey('A'.repeat(64))).toBe(false);
		expect(isValidPubkey('g'.repeat(64))).toBe(false);
		expect(isValidPubkey('')).toBe(false);
		expect(isValidPubkey(undefined)).toBe(false);
	});
});

describe('pubkeysFromTags', () => {
	it('extracts valid pubkeys from p tags', () => {
		expect(
			pubkeysFromTags([
				['p', a],
				['p', b]
			])
		).toEqual([a, b]);
	});

	it('deduplicates', () => {
		expect(
			pubkeysFromTags([
				['p', a],
				['p', a],
				['p', b]
			])
		).toEqual([a, b]);
	});

	it('ignores non-p tags', () => {
		expect(
			pubkeysFromTags([
				['e', a],
				['t', 'nostr'],
				['p', b]
			])
		).toEqual([b]);
	});

	it('filters out invalid pubkeys', () => {
		expect(
			pubkeysFromTags([
				['p', a],
				['p', 'tooshort'],
				['p', 'A'.repeat(64)],
				['p', '']
			])
		).toEqual([a]);
	});

	it('returns empty for no tags', () => {
		expect(pubkeysFromTags([])).toEqual([]);
	});
});
