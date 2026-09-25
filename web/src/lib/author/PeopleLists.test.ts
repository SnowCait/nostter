import { describe, expect, it, vi } from 'vitest';
import type * as Nostr from 'nostr-typedef';
import type { Encryption } from '$lib/nostr/signing/signer';
const cachedGet = vi.hoisted(() => vi.fn());
vi.mock('$lib/cache/Events', () => ({ accountAddressableEventCache: { get: cachedGet } }));
vi.mock('$lib/auth.svelte', () => ({ auth: { pubkey: 'author-pubkey' } }));
import { addToPeopleList, isPeopleList } from './PeopleLists';

function event(kind = 30000, tags: string[][] = []): Nostr.Event {
	return {
		kind,
		tags,
		pubkey: 'author-pubkey',
		content: 'ciphertext',
		created_at: 0,
		id: '',
		sig: ''
	};
}

function encryption(decrypt: Encryption['decrypt']): Encryption {
	return { encrypt: vi.fn(), decrypt };
}

describe('isPeopleList', () => {
	it('rejects other kinds without requesting capabilities', async () => {
		const getCapabilities = vi.fn(() => ({}));

		await expect(isPeopleList(event(1), getCapabilities)).resolves.toBe(false);
		expect(getCapabilities).not.toHaveBeenCalled();
	});

	it('rejects mute lists without requesting capabilities', async () => {
		const getCapabilities = vi.fn(() => ({}));

		await expect(isPeopleList(event(30000, [['d', 'mute']]), getCapabilities)).resolves.toBe(
			false
		);
		expect(getCapabilities).not.toHaveBeenCalled();
	});

	it('accepts a public p tag without requesting capabilities', async () => {
		const getCapabilities = vi.fn(() => {
			throw new Error('capabilities should not be requested');
		});

		await expect(isPeopleList(event(30000, [['p', 'pubkey']]), getCapabilities)).resolves.toBe(
			true
		);
		expect(getCapabilities).not.toHaveBeenCalled();
	});

	it('uses one NIP-04 capability snapshot when decryption is needed', async () => {
		const decrypt = vi.fn(async () => 'plaintext');
		const getCapabilities = vi.fn(() => ({ nip04: encryption(decrypt) }));

		await expect(isPeopleList(event(), getCapabilities)).resolves.toBe(true);
		expect(getCapabilities).toHaveBeenCalledOnce();
		expect(decrypt).toHaveBeenCalledOnce();
		expect(decrypt).toHaveBeenCalledWith('author-pubkey', 'ciphertext');
	});

	it('returns false when the capability provider fails', async () => {
		const getCapabilities = vi.fn(() => {
			throw new Error('No signer');
		});

		await expect(isPeopleList(event(), getCapabilities)).resolves.toBe(false);
		expect(getCapabilities).toHaveBeenCalledOnce();
	});

	it('returns false when NIP-04 is unavailable without falling back to NIP-44', async () => {
		const nip44Decrypt = vi.fn(async () => 'plaintext');
		const getCapabilities = vi.fn(() => ({
			nip04: undefined,
			nip44: encryption(nip44Decrypt)
		}));

		await expect(isPeopleList(event(), getCapabilities)).resolves.toBe(false);
		expect(getCapabilities).toHaveBeenCalledOnce();
		expect(nip44Decrypt).not.toHaveBeenCalled();
	});

	it('returns false when NIP-04 decryption fails', async () => {
		const decrypt = vi.fn(async () => {
			throw new Error('Cannot decrypt');
		});
		const getCapabilities = vi.fn(() => ({ nip04: encryption(decrypt) }));

		await expect(isPeopleList(event(), getCapabilities)).resolves.toBe(false);
		expect(getCapabilities).toHaveBeenCalledOnce();
		expect(decrypt).toHaveBeenCalledOnce();
	});
});

describe('PeopleLists validation cache', () => {
	it('reads the event address in its explicit pubkey namespace', async () => {
		const candidate = event(30000, [['d', 'group']]);
		candidate.created_at = 1;
		cachedGet.mockReset().mockResolvedValue({ ...candidate, created_at: 2 });
		const signEvent = vi.fn();
		await addToPeopleList(signEvent, candidate, 'another-pubkey');
		expect(cachedGet).toHaveBeenCalledWith(candidate.pubkey, candidate.kind, 'group');
		expect(signEvent).not.toHaveBeenCalled();
	});
});
