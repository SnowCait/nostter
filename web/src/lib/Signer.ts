import {
	resolveSigner,
	establishBunkerConnection,
	abolishBunkerConnection
} from './signer-strategy';
import type { Event, EventTemplate } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';

export class Signer {
	public static async establishBunkerConnection(bunker: string): Promise<void> {
		return establishBunkerConnection(bunker);
	}

	public static async abolishBunkerConnection(): Promise<void> {
		return abolishBunkerConnection();
	}

	public static async getPublicKey(): Promise<string> {
		return resolveSigner().getPublicKey();
	}

	public static async signEvent(
		unsignedEvent: EventTemplate | Nostr.UnsignedEvent
	): Promise<Event> {
		return resolveSigner().signEvent(unsignedEvent);
	}

	public static async encrypt(pubkey: string, plaintext: string): Promise<string> {
		return resolveSigner().encrypt(pubkey, plaintext);
	}

	public static async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		return resolveSigner().decrypt(pubkey, ciphertext);
	}

	public static async encryptNip44(pubkey: string, plaintext: string): Promise<string> {
		return resolveSigner().encryptNip44(pubkey, plaintext);
	}

	public static async decryptNip44(pubkey: string, ciphertext: string): Promise<string> {
		return resolveSigner().decryptNip44(pubkey, ciphertext);
	}
}
