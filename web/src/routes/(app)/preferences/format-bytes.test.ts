import { describe, expect, it } from 'vitest';
import { formatBytes } from './format-bytes';

describe('formatBytes', () => {
	it.each([
		[0, '0 B'],
		[1, '1 B'],
		[1023, '1,023 B'],
		[1024, '1 KiB'],
		[1536, '1.5 KiB'],
		[1024 ** 2, '1 MiB'],
		[1024 ** 3, '1 GiB'],
		[1024 ** 4, '1,024 GiB']
	])('formats %i bytes as %s', (bytes, expected) => {
		expect(formatBytes(bytes)).toBe(expected);
	});

	it('uses the requested locale without unnecessary decimal places', () => {
		expect(formatBytes(1536, 'de')).toBe('1,5 KiB');
		expect(formatBytes(1024, 'ja')).toBe('1 KiB');
	});
});
