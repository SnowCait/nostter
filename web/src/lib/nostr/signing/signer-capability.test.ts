import { describe, it, expect } from 'vitest';
import { signerCanSign } from '$lib/nostr/signing/signer-capability';

describe('signerCanSign', () => {
	it('returns true for signing capable types', () => {
		expect(signerCanSign('NIP-07')).toBe(true);
		expect(signerCanSign('NIP-46')).toBe(true);
		expect(signerCanSign('nsec')).toBe(true);
	});

	it('returns false for npub and undefined', () => {
		expect(signerCanSign('npub')).toBe(false);
		expect(signerCanSign(undefined)).toBe(false);
	});
});
