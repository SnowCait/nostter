import { describe, expect, it } from 'vitest';
import { isRelayUrl, isSecureRelayUrl } from './relay-url';

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

describe('isSecureRelayUrl', () => {
	it('accepts wss: URLs', () => {
		expect(isSecureRelayUrl('wss://relay.example.com')).toBe(true);
	});

	it('rejects ws: URLs', () => {
		expect(isSecureRelayUrl('ws://relay.example.com')).toBe(false);
	});

	it('rejects other schemes', () => {
		expect(isSecureRelayUrl('https://relay.example.com')).toBe(false);
		expect(isSecureRelayUrl('http://relay.example.com')).toBe(false);
	});

	it('rejects malformed URLs and non-string values', () => {
		expect(isSecureRelayUrl('wss://')).toBe(false);
		expect(isSecureRelayUrl('relay.example.com')).toBe(false);
		expect(isSecureRelayUrl(undefined)).toBe(false);
	});
});
