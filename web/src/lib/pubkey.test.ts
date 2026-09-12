import { describe, expect, it } from 'vitest';
import { pubkeysFromTags } from './pubkey';

const a = 'a'.repeat(64);
const b = 'b'.repeat(64);

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
