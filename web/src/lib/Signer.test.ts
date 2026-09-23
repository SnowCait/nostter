import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event, EventTemplate } from 'nostr-tools';
import { auth } from './auth.svelte';
import type { Signer as SigningSigner } from './nostr/signing/signer';
import { Signer } from './Signer';

afterEach(() => {
	auth.reset();
	vi.clearAllMocks();
});

describe('Signer facade', () => {
	it('throws a logic error for every operation in an anonymous session', async () => {
		await expect(Signer.getPublicKey()).rejects.toThrow('[logic error]');
		await expect(Signer.signEvent({} as EventTemplate)).rejects.toThrow('[logic error]');
		await expect(Signer.encrypt('peer', 'plain')).rejects.toThrow('[logic error]');
		await expect(Signer.decrypt('peer', 'cipher')).rejects.toThrow('[logic error]');
		await expect(Signer.encryptNip44('peer', 'plain')).rejects.toThrow('[logic error]');
		await expect(Signer.decryptNip44('peer', 'cipher')).rejects.toThrow('[logic error]');
	});

	it('throws a logic error in an authenticated session without a signer', async () => {
		auth.establish('pubkey', [], undefined);

		await expect(Signer.getPublicKey()).rejects.toThrow('[logic error]');
	});

	it('throws a logic error after the session is reset', async () => {
		auth.establish('pubkey', [], { getPublicKey: vi.fn(), signEvent: vi.fn() });
		auth.reset();

		await expect(Signer.getPublicKey()).rejects.toThrow('[logic error]');
	});

	it('delegates every operation to the attached signer instance', async () => {
		const signedEvent = { id: 'event' } as Event;
		const nip04 = {
			encrypt: vi.fn().mockResolvedValue('nip04-ciphertext'),
			decrypt: vi.fn().mockResolvedValue('nip04-plaintext')
		};
		const nip44 = {
			encrypt: vi.fn().mockResolvedValue('nip44-ciphertext'),
			decrypt: vi.fn().mockResolvedValue('nip44-plaintext')
		};
		const signer = {
			getPublicKey: vi.fn().mockResolvedValue('pubkey'),
			signEvent: vi.fn().mockResolvedValue(signedEvent),
			nip04,
			nip44
		} satisfies SigningSigner;
		const unsignedEvent = { kind: 1 } as EventTemplate;
		auth.establish('pubkey', [], signer);

		await expect(Signer.getPublicKey()).resolves.toBe('pubkey');
		await expect(Signer.signEvent(unsignedEvent)).resolves.toBe(signedEvent);
		await expect(Signer.encrypt('peer', 'plain')).resolves.toBe('nip04-ciphertext');
		await expect(Signer.decrypt('peer', 'cipher')).resolves.toBe('nip04-plaintext');
		await expect(Signer.encryptNip44('peer', 'plain')).resolves.toBe('nip44-ciphertext');
		await expect(Signer.decryptNip44('peer', 'cipher')).resolves.toBe('nip44-plaintext');

		expect(signer.signEvent).toHaveBeenCalledWith(unsignedEvent);
		expect(nip04.encrypt).toHaveBeenCalledWith('peer', 'plain');
		expect(nip04.decrypt).toHaveBeenCalledWith('peer', 'cipher');
		expect(nip44.encrypt).toHaveBeenCalledWith('peer', 'plain');
		expect(nip44.decrypt).toHaveBeenCalledWith('peer', 'cipher');
	});

	it.each([
		['NIP-04', () => Signer.encrypt('peer', 'plain')],
		['NIP-44', () => Signer.encryptNip44('peer', 'plain')]
	])('throws when the %s capability is unavailable', async (_name, encrypt) => {
		auth.establish('pubkey', [], { getPublicKey: vi.fn(), signEvent: vi.fn() });

		await expect(encrypt()).rejects.toThrow('[logic error]');
	});
});
