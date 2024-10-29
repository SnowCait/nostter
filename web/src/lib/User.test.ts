import { describe, it, expect } from 'vitest';
import { User } from './User';

describe('decode test', () => {
	it('npub', async () => {
		expect(
			await User.decode('npub19rfhux6gjsmu0rtyendlrazvyr3lqy7m506vy4emy4vehf3s3s3qhhje7x')
		).toStrictEqual({
			pubkey: '28d37e1b489437c78d64ccdbf1f44c20e3f013dba3f4c2573b25599ba6308c22',
			relays: []
		});
	});
	it('nprofile', async () => {
		expect(
			await User.decode(
				'nprofile1qqsz35m7rdyfgd7834jvekl373xzpclsz0d68axz2uaj2kvm5ccgcgspz9mhxue69uhk27rpd4cxcefwvdhk6ch7fya'
			)
		).toStrictEqual({
			pubkey: '28d37e1b489437c78d64ccdbf1f44c20e3f013dba3f4c2573b25599ba6308c22',
			relays: ['wss://example.com']
		});
	});
	it('NIP-05', async () => {
		expect(await User.decode('test@snowcait.github.io')).toStrictEqual({
			pubkey: '28d37e1b489437c78d64ccdbf1f44c20e3f013dba3f4c2573b25599ba6308c22',
			relays: []
		});
	});
	it('NIP-05 case-insensitive', async () => {
		expect(await User.decode('TEST@snowcait.github.io')).toStrictEqual({
			pubkey: '28d37e1b489437c78d64ccdbf1f44c20e3f013dba3f4c2573b25599ba6308c22',
			relays: []
		});
	});
});
