import { describe, expect, it } from 'vitest';
import { isValidEventId } from './event-id';

describe('isValidEventId', () => {
	it('accepts 64-character lowercase hexadecimal strings', () => {
		expect(isValidEventId('a'.repeat(64))).toBe(true);
		expect(isValidEventId('0123456789abcdef'.repeat(4))).toBe(true);
	});

	it('rejects invalid values', () => {
		expect(isValidEventId('a'.repeat(63))).toBe(false);
		expect(isValidEventId('a'.repeat(65))).toBe(false);
		expect(isValidEventId('A'.repeat(64))).toBe(false);
		expect(isValidEventId('g'.repeat(64))).toBe(false);
		expect(isValidEventId('')).toBe(false);
		expect(isValidEventId(undefined)).toBe(false);
		expect(isValidEventId(null)).toBe(false);
		expect(isValidEventId(0)).toBe(false);
		expect(isValidEventId({})).toBe(false);
	});
});
