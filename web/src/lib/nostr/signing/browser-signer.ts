import type { Event, EventTemplate } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import type { Signer } from './signer';

declare const window: {
	nostr: Nostr.Nip07.Nostr | undefined;
};

export class BrowserSigner implements Signer {
	async getPublicKey(): Promise<string> {
		if (window.nostr !== undefined) {
			return window.nostr.getPublicKey();
		}
		throw new Error('[logic error]');
	}

	async signEvent(unsignedEvent: EventTemplate | Nostr.UnsignedEvent): Promise<Event> {
		if (window.nostr !== undefined) {
			return await window.nostr.signEvent(unsignedEvent);
		}
		throw new Error('[logic error]');
	}

	async encrypt(pubkey: string, plaintext: string): Promise<string> {
		if (window.nostr !== undefined && window.nostr.nip04 !== undefined) {
			return await window.nostr.nip04.encrypt(pubkey, plaintext);
		}
		throw new Error('[logic error]');
	}

	async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		if (window.nostr !== undefined && window.nostr.nip04 !== undefined) {
			return await window.nostr.nip04.decrypt(pubkey, ciphertext);
		}
		throw new Error('[logic error]');
	}

	async encryptNip44(pubkey: string, plaintext: string): Promise<string> {
		if (window.nostr !== undefined && window.nostr.nip44 !== undefined) {
			return await window.nostr.nip44.encrypt(pubkey, plaintext);
		}
		throw new Error('[logic error]');
	}

	async decryptNip44(pubkey: string, ciphertext: string): Promise<string> {
		if (window.nostr !== undefined && window.nostr.nip44 !== undefined) {
			return await window.nostr.nip44.decrypt(pubkey, ciphertext);
		}
		throw new Error('[logic error]');
	}
}
