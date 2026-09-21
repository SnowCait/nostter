import {
	resolveSigner,
	establishBunkerConnection,
	abolishBunkerConnection
} from './signer-strategy';
import type { Event, EventTemplate } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import type { EncryptionCapabilities } from './nostr/signing/signer';

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

	public static getEncryptionCapabilities(): EncryptionCapabilities {
		const { nip04, nip44 } = resolveSigner();
		return { nip04, nip44 };
	}

	public static async encrypt(pubkey: string, plaintext: string): Promise<string> {
		const nip04 = resolveSigner().nip04;
		if (nip04 === undefined) {
			throw new Error('[logic error]');
		}
		return nip04.encrypt(pubkey, plaintext);
	}

	public static async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		const nip04 = resolveSigner().nip04;
		if (nip04 === undefined) {
			throw new Error('[logic error]');
		}
		return nip04.decrypt(pubkey, ciphertext);
	}

	public static async encryptNip44(pubkey: string, plaintext: string): Promise<string> {
		const nip44 = resolveSigner().nip44;
		if (nip44 === undefined) {
			throw new Error('[logic error]');
		}
		return nip44.encrypt(pubkey, plaintext);
	}

	public static async decryptNip44(pubkey: string, ciphertext: string): Promise<string> {
		const nip44 = resolveSigner().nip44;
		if (nip44 === undefined) {
			throw new Error('[logic error]');
		}
		return nip44.decrypt(pubkey, ciphertext);
	}
}
