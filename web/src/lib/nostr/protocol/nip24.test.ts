import { describe, expect, it } from 'vitest';
import { parseLegacyRelayList } from './nip24';

describe('parseLegacyRelayList', () => {
	it('returns valid ws: and wss: relay entries', () => {
		const content = JSON.stringify({
			'wss://relay.example.com': { read: true, write: true },
			'ws://relay.example.com': { read: true, write: false }
		});
		expect(parseLegacyRelayList(content)).toEqual(
			new Map([
				['wss://relay.example.com', { read: true, write: true }],
				['ws://relay.example.com', { read: true, write: false }]
			])
		);
	});

	it('excludes non-WebSocket URLs', () => {
		const content = JSON.stringify({
			'wss://relay.example.com': { read: true, write: true },
			'https://example.com': { read: true, write: false },
			'http://example.com': { read: true, write: false }
		});
		expect(parseLegacyRelayList(content)).toEqual(
			new Map([['wss://relay.example.com', { read: true, write: true }]])
		);
	});

	it('excludes invalid URLs', () => {
		const content = JSON.stringify({
			'wss://relay.example.com': { read: true, write: true },
			'not a url': { read: true, write: false }
		});
		expect(parseLegacyRelayList(content)).toEqual(
			new Map([['wss://relay.example.com', { read: true, write: true }]])
		);
	});

	it('returns an empty Map for malformed JSON', () => {
		expect(parseLegacyRelayList('{invalid')).toEqual(new Map());
	});
});
