import { establishBunkerConnection, abolishBunkerConnection } from './nip46-connection';
import type { Event, EventTemplate } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import type { EncryptionCapabilities } from './nostr/signing/signer';
import { getActiveSigner } from './nostr/signing/active-signer';
import type { RemoteSignerClient } from './nostr/signing/remote-signer-client';

export class Signer {
	public static async establishBunkerConnection(bunker: string): Promise<RemoteSignerClient> {
		return establishBunkerConnection(bunker);
	}

	public static async abolishBunkerConnection(): Promise<void> {
		return abolishBunkerConnection();
	}

	public static async getPublicKey(): Promise<string> {
		return getActiveSigner().getPublicKey();
	}

	public static async signEvent(
		unsignedEvent: EventTemplate | Nostr.UnsignedEvent
	): Promise<Event> {
		return getActiveSigner().signEvent(unsignedEvent);
	}

	public static getEncryptionCapabilities(): EncryptionCapabilities {
		const { nip04, nip44 } = getActiveSigner();
		return { nip04, nip44 };
	}

	public static async encrypt(pubkey: string, plaintext: string): Promise<string> {
		const nip04 = getActiveSigner().nip04;
		if (nip04 === undefined) {
			throw new Error('[logic error]');
		}
		return nip04.encrypt(pubkey, plaintext);
	}

	public static async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		const nip04 = getActiveSigner().nip04;
		if (nip04 === undefined) {
			throw new Error('[logic error]');
		}
		return nip04.decrypt(pubkey, ciphertext);
	}

	public static async encryptNip44(pubkey: string, plaintext: string): Promise<string> {
		const nip44 = getActiveSigner().nip44;
		if (nip44 === undefined) {
			throw new Error('[logic error]');
		}
		return nip44.encrypt(pubkey, plaintext);
	}

	public static async decryptNip44(pubkey: string, ciphertext: string): Promise<string> {
		const nip44 = getActiveSigner().nip44;
		if (nip44 === undefined) {
			throw new Error('[logic error]');
		}
		return nip44.decrypt(pubkey, ciphertext);
	}
}
