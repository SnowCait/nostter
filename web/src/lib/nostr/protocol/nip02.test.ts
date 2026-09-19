import { describe, expect, it } from 'vitest';
import { parseFollowList } from './nip02';

const a = 'a'.repeat(64);
const b = 'b'.repeat(64);

describe('parseFollowList', () => {
	it('extracts pubkey, relay URL, and petname from a p tag', () => {
		expect(parseFollowList([['p', a, 'wss://relay.example.com', 'alice']])).toEqual([
			{ pubkey: a, relayUrl: 'wss://relay.example.com', petname: 'alice' }
		]);
	});

	it('treats empty or omitted relay URL and petname as absent', () => {
		expect(parseFollowList([['p', a, '', '']])).toEqual([
			{ pubkey: a, relayUrl: undefined, petname: undefined }
		]);
		expect(parseFollowList([['p', a]])).toEqual([
			{ pubkey: a, relayUrl: undefined, petname: undefined }
		]);
	});

	it('drops an invalid relay URL but keeps the follow entry', () => {
		expect(parseFollowList([['p', a, 'not-a-url']])).toEqual([
			{ pubkey: a, relayUrl: undefined, petname: undefined }
		]);
	});

	it('ignores non-p tags', () => {
		expect(
			parseFollowList([
				['e', a],
				['t', 'nostr'],
				['p', b]
			])
		).toEqual([{ pubkey: b, relayUrl: undefined, petname: undefined }]);
	});

	it('excludes entries with an invalid pubkey', () => {
		expect(
			parseFollowList([
				['p', a],
				['p', 'tooshort'],
				['p', 'A'.repeat(64)],
				['p', '']
			])
		).toEqual([{ pubkey: a, relayUrl: undefined, petname: undefined }]);
	});

	it('preserves duplicate pubkeys as separate entries', () => {
		expect(
			parseFollowList([
				['p', a, 'wss://relay1.example.com'],
				['p', a, 'wss://relay2.example.com']
			])
		).toEqual([
			{ pubkey: a, relayUrl: 'wss://relay1.example.com', petname: undefined },
			{ pubkey: a, relayUrl: 'wss://relay2.example.com', petname: undefined }
		]);
	});
});
