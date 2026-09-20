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
});
