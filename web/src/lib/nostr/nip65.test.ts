import { describe, expect, it } from 'vitest';
import { parseRelayList } from './nip65';

const URL1 = 'wss://relay.example.com/';

describe('parseRelayList', () => {
	it('no marker → read and write', () => {
		expect(parseRelayList([['r', 'wss://RELAY.EXAMPLE.COM:443']])).toEqual([
			{ url: URL1, read: true, write: true }
		]);
	});

	it('"read" marker → read only', () => {
		expect(parseRelayList([['r', URL1, 'read']])).toEqual([
			{ url: URL1, read: true, write: false }
		]);
	});

	it('"write" marker → write only', () => {
		expect(parseRelayList([['r', URL1, 'write']])).toEqual([
			{ url: URL1, read: false, write: true }
		]);
	});

	it('invalid relay URL → excluded', () => {
		const result = parseRelayList([
			['r', 'not-a-url'],
			['r', 'ws://nos.lol'],
			['r', URL1]
		]);
		expect(result).toHaveLength(1);
		expect(result[0].url).toBe(URL1);
	});

	it('unknown marker → excluded', () => {
		expect(parseRelayList([['r', URL1, 'admin']])).toHaveLength(0);
	});

	it('empty-string marker → excluded', () => {
		expect(parseRelayList([['r', URL1, '']])).toHaveLength(0);
	});

	it('duplicate URL with different markers → both entries preserved', () => {
		const result = parseRelayList([
			['r', URL1, 'read'],
			['r', URL1, 'write']
		]);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ url: URL1, read: true, write: false });
		expect(result[1]).toEqual({ url: URL1, read: false, write: true });
	});
});
