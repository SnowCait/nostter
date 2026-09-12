import { describe, expect, it } from 'vitest';
import { isValidPubkey } from './pubkey';

const a = 'a'.repeat(64);

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
		expect(isValidPubkey(null)).toBe(false);
		expect(isValidPubkey(0)).toBe(false);
		expect(isValidPubkey({})).toBe(false);
	});
});
