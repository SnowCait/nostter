import type { Event, EventTemplate } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';

export interface Encryption {
	encrypt(pubkey: string, plaintext: string): Promise<string>;
	decrypt(pubkey: string, ciphertext: string): Promise<string>;
}

export interface Signer {
	getPublicKey(): Promise<string>;
	signEvent(unsignedEvent: EventTemplate | Nostr.UnsignedEvent): Promise<Event>;
	readonly nip04?: Encryption;
	readonly nip44?: Encryption;
	dispose?(): Promise<void>;
}

export type EncryptionCapabilities = Pick<Signer, 'nip04' | 'nip44'>;
