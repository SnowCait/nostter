import { describe, expect, it, vi } from 'vitest';
import type { Signer as SigningSigner } from './nostr/signing/signer';
import { Signer } from './Signer';
import { resolveSigner } from './signer-strategy';

vi.mock('./signer-strategy', () => ({
	resolveSigner: vi.fn(),
	establishBunkerConnection: vi.fn(),
	abolishBunkerConnection: vi.fn()
}));

describe('Signer encryption facade', () => {
	it('delegates encryption operations through available NIP capabilities', async () => {
		const nip04 = {
			encrypt: vi.fn().mockResolvedValue('nip04-ciphertext'),
			decrypt: vi.fn().mockResolvedValue('nip04-plaintext')
		};
		const nip44 = {
			encrypt: vi.fn().mockResolvedValue('nip44-ciphertext'),
			decrypt: vi.fn().mockResolvedValue('nip44-plaintext')
		};
		const signer = {
			getPublicKey: vi.fn(),
			signEvent: vi.fn(),
			nip04,
			nip44
		} satisfies SigningSigner;
		vi.mocked(resolveSigner).mockReturnValue(signer);

		await expect(Signer.encrypt('peer', 'plain')).resolves.toBe('nip04-ciphertext');
		await expect(Signer.decrypt('peer', 'cipher')).resolves.toBe('nip04-plaintext');
		await expect(Signer.encryptNip44('peer', 'plain')).resolves.toBe('nip44-ciphertext');
		await expect(Signer.decryptNip44('peer', 'cipher')).resolves.toBe('nip44-plaintext');

		expect(nip04.encrypt).toHaveBeenCalledWith('peer', 'plain');
		expect(nip04.decrypt).toHaveBeenCalledWith('peer', 'cipher');
		expect(nip44.encrypt).toHaveBeenCalledWith('peer', 'plain');
		expect(nip44.decrypt).toHaveBeenCalledWith('peer', 'cipher');
	});

	it.each([
		['NIP-04', () => Signer.encrypt('peer', 'plain')],
		['NIP-44', () => Signer.encryptNip44('peer', 'plain')]
	])('throws when the %s capability is unavailable', async (_name, encrypt) => {
		const signer = { getPublicKey: vi.fn(), signEvent: vi.fn() } satisfies SigningSigner;
		vi.mocked(resolveSigner).mockReturnValue(signer);

		await expect(encrypt()).rejects.toThrow('[logic error]');
	});
});
