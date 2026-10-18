import { describe, expect, it } from 'vitest';
import { Metadata } from './Items';

describe('Metadata.normalizedNip05', () => {
	it.each([
		['TeSt@ExAmPlE.CoM', 'test@example.com'],
		['_@ExAmPlE.CoM', 'example.com']
	])('normalizes %s to %s', (nip05, expected) => {
		const metadata = new Metadata({
			id: 'a'.repeat(64),
			pubkey: 'b'.repeat(64),
			kind: 0,
			created_at: 0,
			tags: [],
			content: JSON.stringify({ nip05 }),
			sig: ''
		});

		expect(metadata.normalizedNip05).toBe(expected);
	});
});
