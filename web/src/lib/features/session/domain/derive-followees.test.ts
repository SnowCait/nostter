import { describe, expect, it } from 'vitest';
import { deriveFollowees } from './derive-followees';

const me = 'f'.repeat(64);
const a = 'a'.repeat(64);
const b = 'b'.repeat(64);

describe('deriveFollowees', () => {
	it('derives originalFollowees from valid p tags', () => {
		const { originalFollowees } = deriveFollowees(
			[
				['p', a],
				['p', b]
			],
			me
		);

		expect(originalFollowees).toEqual([a, b]);
	});

	it('deduplicates duplicate p tags', () => {
		const { originalFollowees, followees } = deriveFollowees(
			[
				['p', a],
				['p', a],
				['p', b]
			],
			me
		);

		expect(originalFollowees).toEqual([a, b]);
		expect(followees).toEqual([a, b, me]);
	});

	it('excludes invalid pubkeys', () => {
		const { originalFollowees } = deriveFollowees(
			[
				['p', a],
				['p', 'invalid'],
				['e', b]
			],
			me
		);

		expect(originalFollowees).toEqual([a]);
	});

	it('adds the account pubkey to followees', () => {
		const { followees } = deriveFollowees([['p', a]], me);

		expect(followees).toEqual([a, me]);
	});

	it('does not duplicate the account pubkey when already present in tags', () => {
		const { followees } = deriveFollowees(
			[
				['p', a],
				['p', me]
			],
			me
		);

		expect(followees).toEqual([a, me]);
	});

	it('returns an empty originalFollowees and only the account pubkey in followees for empty tags', () => {
		const { originalFollowees, followees } = deriveFollowees([], me);

		expect(originalFollowees).toEqual([]);
		expect(followees).toEqual([me]);
	});

	it('does not mutate the input tags', () => {
		const tags = [
			['p', a],
			['p', b]
		];
		const snapshot = tags.map((tag) => [...tag]);

		deriveFollowees(tags, me);

		expect(tags).toEqual(snapshot);
	});
});
