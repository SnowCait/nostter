import {
	type Event,
	type EventTemplate,
	finalizeEvent,
	getPublicKey,
	nip04,
	nip44
} from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import type { Signer } from './signer';

export class PrivateKeySigner implements Signer {
	constructor(private readonly secretKey: Uint8Array) {}

	async getPublicKey(): Promise<string> {
		return getPublicKey(this.secretKey);
	}

	async signEvent(unsignedEvent: EventTemplate | Nostr.UnsignedEvent): Promise<Event> {
		return finalizeEvent(unsignedEvent, this.secretKey);
	}

	async encrypt(pubkey: string, plaintext: string): Promise<string> {
		return await nip04.encrypt(this.secretKey, pubkey, plaintext);
	}

	async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		return await nip04.decrypt(this.secretKey, pubkey, ciphertext);
	}

	async encryptNip44(pubkey: string, plaintext: string): Promise<string> {
		const conversationKey = nip44.getConversationKey(this.secretKey, pubkey);
		return await nip44.encrypt(plaintext, conversationKey);
	}

	async decryptNip44(pubkey: string, ciphertext: string): Promise<string> {
		const conversationKey = nip44.getConversationKey(this.secretKey, pubkey);
		return await nip44.decrypt(ciphertext, conversationKey);
	}
}
