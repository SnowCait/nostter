import { describe, expect, it } from 'vitest';
import { normalizeRelayUrl, normalizeRelayUrls } from './relay-url';

describe('normalizeRelayUrl', () => {
	it.each([
		['wss://relay.example.com', 'wss://relay.example.com/'],
		['wss://relay.example.com:443/path', 'wss://relay.example.com/path'],
		[' WSS://RELAY.EXAMPLE.COM:443/a/../path?x=1 ', 'wss://relay.example.com/path?x=1'],
		['ws://localhost', 'ws://localhost/'],
		['ws://localhost:7777', 'ws://localhost:7777/'],
		['ws://localhost.', 'ws://localhost./'],
		['ws://foo.localhost', 'ws://foo.localhost/'],
		['ws://foo.localhost.', 'ws://foo.localhost./'],
		['ws://FOO.LOCALHOST:80', 'ws://foo.localhost/'],
		['ws://127.0.0.1', 'ws://127.0.0.1/'],
		['ws://127.0.0.0', 'ws://127.0.0.0/'],
		['ws://127.42.1.2:7777', 'ws://127.42.1.2:7777/'],
		['ws://127.255.255.255', 'ws://127.255.255.255/'],
		['ws://127.1', 'ws://127.0.0.1/'],
		['ws://2130706433', 'ws://127.0.0.1/'],
		['ws://0x7f000001', 'ws://127.0.0.1/'],
		['ws://[::1]', 'ws://[::1]/'],
		['ws://[::1]:7777', 'ws://[::1]:7777/'],
		['ws://[0:0:0:0:0:0:0:1]', 'ws://[::1]/']
	])('normalizes %s', (input, expected) => {
		expect(normalizeRelayUrl(input)).toBe(expected);
		expect(normalizeRelayUrl(expected)).toBe(expected);
	});

	it.each([
		'ws://nos.lol',
		'ws://nostr.mom',
		'ws://umbrel.local',
		'ws://192.168.1.1',
		'ws://10.0.0.1',
		'ws://172.16.0.1',
		'ws://localhost.example.com',
		'ws://notlocalhost',
		'ws://127.0.0.1.example.com',
		'ws://localhost@nos.lol',
		'ws://126.255.255.255',
		'ws://128.0.0.0',
		'ws://[::]',
		'ws://[::ffff:127.0.0.1]',
		'http://relay.example.com',
		'https://relay.example.com',
		'ftp://relay.example.com',
		'not-a-url',
		'wss://',
		'ws://127.0.0.999',
		'ws://[::1',
		'ws://localhost:99999',
		'',
		null,
		undefined,
		42
	])('rejects %s', (input) => {
		expect(normalizeRelayUrl(input)).toBeUndefined();
	});
});

it('normalizes relay lists and excludes unusable entries', () => {
	expect(normalizeRelayUrls(['wss://RELAY.EXAMPLE.COM:443', 'ws://nos.lol', undefined])).toEqual([
		'wss://relay.example.com/'
	]);
});
