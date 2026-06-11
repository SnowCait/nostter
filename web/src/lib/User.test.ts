import { describe, it, expect, vi, afterEach } from 'vitest';
import { User } from './User';

const pubkey = '28d37e1b489437c78d64ccdbf1f44c20e3f013dba3f4c2573b25599ba6308c22';

function stubNip05(body: object | null, ok = true): ReturnType<typeof vi.fn> {
	const fetchMock = vi.fn(async () =>
		ok ? Response.json(body) : new Response('Not Found', { status: 404 })
	);
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

afterEach(() => {
	vi.unstubAllGlobals();
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
				'https://example.com/.well-known/nostr.json?name=test'
			);
		});
		it('case-insensitive', async () => {
			const fetchMock = stubNip05({ names: { test: pubkey } });
			expect(await User.decode('TEST@example.com')).toStrictEqual({
				pubkey,
				relays: []
			});
			expect(fetchMock).toHaveBeenCalledWith(
				'https://example.com/.well-known/nostr.json?name=TEST'
			);
		});
		it('domain only falls back to _', async () => {
			const fetchMock = stubNip05({ names: { _: pubkey } });
			expect(await User.decode('example.com')).toStrictEqual({
				pubkey,
				relays: []
			});
			expect(fetchMock).toHaveBeenCalledWith(
				'https://example.com/.well-known/nostr.json?name=_'
			);
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
