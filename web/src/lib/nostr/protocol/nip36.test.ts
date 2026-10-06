import { describe, expect, it } from 'vitest';
import { getContentWarning } from './nip36';

describe('getContentWarning', () => {
	it('recognizes a NIP-36 content-warning tag with a reason', () => {
		expect(getContentWarning([['content-warning', 'reason']])).toEqual({ reason: 'reason' });
	});

	it('recognizes a NIP-36 content-warning tag without a reason', () => {
		expect(getContentWarning([['content-warning']])).toEqual({ reason: undefined });
	});

	it('returns undefined without a content-warning tag', () => {
		expect(getContentWarning([['t', 'nostr']])).toBeUndefined();
	});
});
