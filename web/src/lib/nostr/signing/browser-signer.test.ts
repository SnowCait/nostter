import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserSigner } from './browser-signer';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('BrowserSigner', () => {
	it('delegates public key retrieval and event signing to window.nostr', async () => {
		const signedEvent = {
			id: 'id',
			pubkey: 'pubkey',
			created_at: 1,
			kind: 1,
			tags: [],
			content: '',
			sig: 'sig'
		};
		const nostr = {
			getPublicKey: vi.fn().mockResolvedValue('pubkey'),
			signEvent: vi.fn().mockResolvedValue(signedEvent)
		};
		vi.stubGlobal('window', { nostr });
		const signer = new BrowserSigner();
		const unsignedEvent = { created_at: 1, kind: 1, tags: [], content: '' };

		await expect(signer.getPublicKey()).resolves.toBe('pubkey');
		await expect(signer.signEvent(unsignedEvent)).resolves.toBe(signedEvent);

		expect(nostr.getPublicKey).toHaveBeenCalledOnce();
		expect(nostr.signEvent).toHaveBeenCalledWith(unsignedEvent);
	});

	it('exposes the available NIP-04 capability from window.nostr', async () => {
		const nip04 = {
			encrypt: vi.fn().mockResolvedValue('nip04-ciphertext'),
			decrypt: vi.fn().mockResolvedValue('nip04-plaintext')
		};
		vi.stubGlobal('window', { nostr: { getPublicKey: vi.fn(), signEvent: vi.fn(), nip04 } });

		const capability = new BrowserSigner().nip04;
		expect(capability).toBe(nip04);
		if (capability === undefined) {
			throw new Error('NIP-04 capability was unavailable');
		}
		await expect(capability.encrypt('peer', 'plaintext')).resolves.toBe('nip04-ciphertext');
		await expect(capability.decrypt('peer', 'ciphertext')).resolves.toBe('nip04-plaintext');

		expect(nip04.encrypt).toHaveBeenCalledWith('peer', 'plaintext');
		expect(nip04.decrypt).toHaveBeenCalledWith('peer', 'ciphertext');
	});

	it('exposes the available NIP-44 capability from window.nostr', async () => {
		const nip44 = {
			encrypt: vi.fn().mockResolvedValue('nip44-ciphertext'),
			decrypt: vi.fn().mockResolvedValue('nip44-plaintext')
		};
		vi.stubGlobal('window', { nostr: { getPublicKey: vi.fn(), signEvent: vi.fn(), nip44 } });

		const capability = new BrowserSigner().nip44;
		expect(capability).toBe(nip44);
		if (capability === undefined) {
			throw new Error('NIP-44 capability was unavailable');
		}
		await expect(capability.encrypt('peer', 'plaintext')).resolves.toBe('nip44-ciphertext');
		await expect(capability.decrypt('peer', 'ciphertext')).resolves.toBe('nip44-plaintext');

		expect(nip44.encrypt).toHaveBeenCalledWith('peer', 'plaintext');
		expect(nip44.decrypt).toHaveBeenCalledWith('peer', 'ciphertext');
	});

	it('is a signer when NIP-04 is unavailable', () => {
		vi.stubGlobal('window', { nostr: { getPublicKey: vi.fn(), signEvent: vi.fn() } });

		expect(new BrowserSigner().nip04).toBeUndefined();
	});

	it('is a signer when NIP-44 is unavailable', () => {
		vi.stubGlobal('window', { nostr: { getPublicKey: vi.fn(), signEvent: vi.fn() } });

		expect(new BrowserSigner().nip44).toBeUndefined();
	});
});
