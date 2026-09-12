import { describe, expect, it } from 'vitest';
import { generateSecretKey, getPublicKey, nip04, nip44 } from 'nostr-tools';
import { isLegacyEncryption } from './nip04';

describe('isLegacyEncryption', () => {
	const seckey = generateSecretKey();
	const pubkey = getPublicKey(seckey);
	it('legacy', () => {
		const nip04Content = nip04.encrypt(seckey, pubkey, 'content');
		expect(isLegacyEncryption(nip04Content)).toBe(true);
	});
	it('not legacy', () => {
		const conversationKey = nip44.getConversationKey(seckey, pubkey);
		const nip44Content = nip44.encrypt('content', conversationKey);
		expect(isLegacyEncryption(nip44Content)).toBe(false);
	});
});
