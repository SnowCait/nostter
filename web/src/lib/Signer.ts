import type { Event, EventTemplate } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import { auth } from './auth.svelte';
import type { Signer as SigningSigner } from './nostr/signing/signer';

function getSessionSigner(): SigningSigner {
	const signer = auth.signer;
	if (signer === undefined) {
		throw new Error('[logic error]');
	}
	return signer;
}

export class Signer {
	public static async getPublicKey(): Promise<string> {
		return getSessionSigner().getPublicKey();
	}

	public static async signEvent(
		unsignedEvent: EventTemplate | Nostr.UnsignedEvent
	): Promise<Event> {
		return getSessionSigner().signEvent(unsignedEvent);
	}

	public static async encrypt(pubkey: string, plaintext: string): Promise<string> {
		const nip04 = getSessionSigner().nip04;
		if (nip04 === undefined) {
			throw new Error('[logic error]');
		}
		return nip04.encrypt(pubkey, plaintext);
	}

	public static async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		const nip04 = getSessionSigner().nip04;
		if (nip04 === undefined) {
			throw new Error('[logic error]');
		}
		return nip04.decrypt(pubkey, ciphertext);
	}

	public static async encryptNip44(pubkey: string, plaintext: string): Promise<string> {
		const nip44 = getSessionSigner().nip44;
		if (nip44 === undefined) {
			throw new Error('[logic error]');
		}
		return nip44.encrypt(pubkey, plaintext);
	}

	public static async decryptNip44(pubkey: string, ciphertext: string): Promise<string> {
		const nip44 = getSessionSigner().nip44;
		if (nip44 === undefined) {
			throw new Error('[logic error]');
		}
		return nip44.decrypt(pubkey, ciphertext);
	}
}
