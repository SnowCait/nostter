import { describe, it, expect, vi, afterEach } from 'vitest';
import { nip19 } from 'nostr-tools';
import { useFetchImplementation } from 'nostr-tools/nip05';
import { User } from './User';

const pubkey = '28d37e1b489437c78d64ccdbf1f44c20e3f013dba3f4c2573b25599ba6308c22';

function stubNip05(body: object | null, ok = true): ReturnType<typeof vi.fn> {
	const fetchMock = vi.fn(async () =>
		ok ? Response.json(body) : new Response('Not Found', { status: 404 })
	);
	useFetchImplementation(fetchMock);
	return fetchMock;
}

afterEach(() => {
	useFetchImplementation(fetch);
});

describe('decode test', () => {
	it('npub', async () => {
		expect(
			await User.decode('npub19rfhux6gjsmu0rtyendlrazvyr3lqy7m506vy4emy4vehf3s3s3qhhje7x')
		).toStrictEqual({
			pubkey,
			relays: []
		});
	});
	it('nprofile', async () => {
		expect(
			await User.decode(
				'nprofile1qqsz35m7rdyfgd7834jvekl373xzpclsz0d68axz2uaj2kvm5ccgcgspz9mhxue69uhk27rpd4cxcefwvdhk6ch7fya'
			)
		).toStrictEqual({
			pubkey,
			relays: ['wss://example.com']
		});
	});

	describe('NIP-05', () => {
		it('name@domain', async () => {
			const fetchMock = stubNip05({ names: { test: pubkey } });
			expect(await User.decode('test@example.com')).toStrictEqual({
				pubkey,
				relays: []
			});
			expect(fetchMock).toHaveBeenCalledWith(
				'https://example.com/.well-known/nostr.json?name=test',
				expect.any(Object)
			);
		});
		it('normalizes mixed-case identifiers before resolving', async () => {
			const fetchMock = stubNip05({ names: { test: pubkey } });
			expect(await User.decode('TeSt@ExAmPlE.CoM')).toStrictEqual({
				pubkey,
				relays: []
			});
			expect(fetchMock).toHaveBeenCalledWith(
				'https://example.com/.well-known/nostr.json?name=test',
				expect.any(Object)
			);
		});
		it('domain only falls back to _', async () => {
			const fetchMock = stubNip05({ names: { _: pubkey } });
			expect(await User.decode('example.com')).toStrictEqual({
				pubkey,
				relays: []
			});
			expect(fetchMock).toHaveBeenCalledWith(
				'https://example.com/.well-known/nostr.json?name=_',
				expect.any(Object)
			);
		});
		it('rejects an invalid public key', async () => {
			stubNip05({ names: { test: 'invalid-pubkey' } });
			expect(await User.decode('test@example.com')).toStrictEqual({
				pubkey: undefined,
				relays: []
			});
		});
		it('relays', async () => {
			stubNip05({ names: { test: pubkey }, relays: { [pubkey]: ['wss://example.com'] } });
			expect(await User.decode('test@example.com')).toStrictEqual({
				pubkey,
				relays: ['wss://example.com']
			});
		});
		it('fetch failure', async () => {
			stubNip05(null, false);
			expect(await User.decode('test@example.com')).toStrictEqual({
				pubkey: undefined,
				relays: []
			});
		});
	});
});

describe('external profile relay hints', () => {
	const relays = [
		'invalid-relay',
		'https://relay.example.com/',
		'wss://127.0.0.1/',
		'ws://[::1]/',
		'wss://relay.local/',
		'wss://relay.example.com/'
	];
	it('excludes invalid and non-public relay hints from nprofile pointers', async () => {
		expect(await User.decode(nip19.nprofileEncode({ pubkey, relays }))).toEqual({
			pubkey,
			relays: ['wss://relay.example.com/']
		});
	});
	it('excludes invalid and non-public relay hints from NIP-05 responses', async () => {
		stubNip05({ names: { test: pubkey }, relays: { [pubkey]: relays } });
		expect(await User.decode('test@example.com')).toEqual({
			pubkey,
			relays: ['wss://relay.example.com/']
		});
	});
});
