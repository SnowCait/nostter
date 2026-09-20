import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserSigner } from './browser-signer';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('BrowserSigner', () => {
	it('delegates signing and encryption operations to window.nostr', async () => {
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
			signEvent: vi.fn().mockResolvedValue(signedEvent),
			nip04: {
				encrypt: vi.fn().mockResolvedValue('nip04-ciphertext'),
				decrypt: vi.fn().mockResolvedValue('nip04-plaintext')
			},
			nip44: {
				encrypt: vi.fn().mockResolvedValue('nip44-ciphertext'),
				decrypt: vi.fn().mockResolvedValue('nip44-plaintext')
			}
		};
		vi.stubGlobal('window', { nostr });
		const signer = new BrowserSigner();
		const unsignedEvent = { created_at: 1, kind: 1, tags: [], content: '' };

		await expect(signer.getPublicKey()).resolves.toBe('pubkey');
		await expect(signer.signEvent(unsignedEvent)).resolves.toBe(signedEvent);
		await expect(signer.encrypt('peer', 'plaintext')).resolves.toBe('nip04-ciphertext');
		await expect(signer.decrypt('peer', 'ciphertext')).resolves.toBe('nip04-plaintext');
		await expect(signer.encryptNip44('peer', 'plaintext')).resolves.toBe('nip44-ciphertext');
		await expect(signer.decryptNip44('peer', 'ciphertext')).resolves.toBe('nip44-plaintext');

		expect(nostr.getPublicKey).toHaveBeenCalledOnce();
		expect(nostr.signEvent).toHaveBeenCalledWith(unsignedEvent);
		expect(nostr.nip04.encrypt).toHaveBeenCalledWith('peer', 'plaintext');
		expect(nostr.nip04.decrypt).toHaveBeenCalledWith('peer', 'ciphertext');
		expect(nostr.nip44.encrypt).toHaveBeenCalledWith('peer', 'plaintext');
		expect(nostr.nip44.decrypt).toHaveBeenCalledWith('peer', 'ciphertext');
	});
});
