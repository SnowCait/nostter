import type { Event, EventTemplate } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';

export interface Signer {
	getPublicKey(): Promise<string>;
	signEvent(unsignedEvent: EventTemplate | Nostr.UnsignedEvent): Promise<Event>;
	encrypt(pubkey: string, plaintext: string): Promise<string>;
	decrypt(pubkey: string, ciphertext: string): Promise<string>;
	encryptNip44(pubkey: string, plaintext: string): Promise<string>;
	decryptNip44(pubkey: string, ciphertext: string): Promise<string>;
}
