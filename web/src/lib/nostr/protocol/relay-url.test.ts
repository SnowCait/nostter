import { describe, expect, it } from 'vitest';
import { isRelayUrl } from './relay-url';

describe('isRelayUrl', () => {
	it('accepts wss: URLs', () => {
		expect(isRelayUrl('wss://relay.example.com')).toBe(true);
	});

	it('accepts ws: URLs', () => {
		expect(isRelayUrl('ws://localhost:8080')).toBe(true);
	});

	it('rejects https: URLs', () => {
		expect(isRelayUrl('https://example.com')).toBe(false);
	});

	it('rejects malformed URLs', () => {
		expect(isRelayUrl('not-a-url')).toBe(false);
	});

	it('rejects non-string values', () => {
		expect(isRelayUrl(undefined)).toBe(false);
	});
});
