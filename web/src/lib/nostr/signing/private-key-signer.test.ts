import { generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools';
import { describe, expect, it } from 'vitest';
import { PrivateKeySigner } from './private-key-signer';

describe('PrivateKeySigner', () => {
	it('derives the public key and signs events with its secret key', async () => {
		const secretKey = generateSecretKey();
		const signer = new PrivateKeySigner(secretKey);
		const unsignedEvent = { created_at: 1, kind: 1, tags: [], content: 'hello' };

		await expect(signer.getPublicKey()).resolves.toBe(getPublicKey(secretKey));
		const event = await signer.signEvent(unsignedEvent);
		expect(event.pubkey).toBe(getPublicKey(secretKey));
		expect(verifyEvent(event)).toBe(true);
	});

	it('always provides NIP-04 and NIP-44 encryption capabilities', async () => {
		const secretKey = generateSecretKey();
		const signer = new PrivateKeySigner(secretKey);
		const pubkey = getPublicKey(secretKey);

		const nip04Ciphertext = await signer.nip04.encrypt(pubkey, 'nip04 plaintext');
		await expect(signer.nip04.decrypt(pubkey, nip04Ciphertext)).resolves.toBe(
			'nip04 plaintext'
		);

		const nip44Ciphertext = await signer.nip44.encrypt(pubkey, 'nip44 plaintext');
		await expect(signer.nip44.decrypt(pubkey, nip44Ciphertext)).resolves.toBe(
			'nip44 plaintext'
		);
	});
});
