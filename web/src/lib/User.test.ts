import { beforeEach, describe, it, expect, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import { queryProfile } from 'nostr-tools/nip05';
import { User } from './User';

vi.mock('nostr-tools/nip05', async (importOriginal) => ({
	...(await importOriginal<typeof import('nostr-tools/nip05')>()),
	queryProfile: vi.fn()
}));

const pubkey = '28d37e1b489437c78d64ccdbf1f44c20e3f013dba3f4c2573b25599ba6308c22';
const relays = [
	'invalid-relay',
	'https://relay.example.com/',
	'wss://127.0.0.1/',
	'ws://[::1]/',
	'wss://relay.local/',
	'wss://relay.example.com/'
];
const queryProfileMock = vi.mocked(queryProfile);

beforeEach(() => {
	queryProfileMock.mockReset();
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
		it('resolves a normalized identifier', async () => {
			queryProfileMock.mockResolvedValue({ pubkey });
			expect(await User.decode('test@example.com')).toStrictEqual({
				pubkey,
				relays: []
			});
			expect(queryProfileMock).toHaveBeenCalledWith('test@example.com');
		});
		it('normalizes mixed-case identifiers before resolving', async () => {
			queryProfileMock.mockResolvedValue({ pubkey });
			expect(await User.decode('TeSt@ExAmPlE.CoM')).toStrictEqual({
				pubkey,
				relays: []
			});
			expect(queryProfileMock).toHaveBeenCalledWith('test@example.com');
		});
		it('rejects an invalid public key', async () => {
			queryProfileMock.mockResolvedValue({ pubkey: 'invalid-pubkey' });
			expect(await User.decode('test@example.com')).toStrictEqual({
				pubkey: undefined,
				relays: []
			});
		});
		it('returns undefined when the identifier cannot be resolved', async () => {
			queryProfileMock.mockResolvedValue(null);
			expect(await User.decode('test@example.com')).toStrictEqual({
				pubkey: undefined,
				relays: []
			});
		});
		it('excludes invalid and non-public relay hints', async () => {
			queryProfileMock.mockResolvedValue({ pubkey, relays });
			expect(await User.decode('test@example.com')).toStrictEqual({
				pubkey,
				relays: ['wss://relay.example.com/']
			});
		});
	});
});

describe('nprofile relay hints', () => {
	it('excludes invalid and non-public relay hints', async () => {
		expect(await User.decode(nip19.nprofileEncode({ pubkey, relays }))).toEqual({
			pubkey,
			relays: ['wss://relay.example.com/']
		});
	});
});
