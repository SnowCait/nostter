import {
	type Event,
	type EventTemplate,
	finalizeEvent,
	getPublicKey,
	nip04,
	nip44
} from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import type { Encryption, Signer } from './signer';

export class PrivateKeySigner implements Signer {
	constructor(private readonly secretKey: Uint8Array) {}

	readonly nip04: Encryption = {
		encrypt: async (pubkey, plaintext) =>
			await nip04.encrypt(this.secretKey, pubkey, plaintext),
		decrypt: async (pubkey, ciphertext) =>
			await nip04.decrypt(this.secretKey, pubkey, ciphertext)
	};

	readonly nip44: Encryption = {
		encrypt: async (pubkey, plaintext) => {
			const conversationKey = nip44.getConversationKey(this.secretKey, pubkey);
			return await nip44.encrypt(plaintext, conversationKey);
		},
		decrypt: async (pubkey, ciphertext) => {
			const conversationKey = nip44.getConversationKey(this.secretKey, pubkey);
			return await nip44.decrypt(ciphertext, conversationKey);
		}
	};

	async getPublicKey(): Promise<string> {
		return getPublicKey(this.secretKey);
	}

	async signEvent(unsignedEvent: EventTemplate | Nostr.UnsignedEvent): Promise<Event> {
		return finalizeEvent(unsignedEvent, this.secretKey);
	}
}
