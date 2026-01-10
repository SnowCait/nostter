import {
	type Event,
	nip19,
	type EventTemplate,
	getPublicKey,
	nip04,
	finalizeEvent,
	nip44
} from 'nostr-tools';
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46';
import { generateSecretKey } from 'nostr-tools/pure';
import { bytesToHex, hexToBytes } from 'nostr-tools/utils';
import { WebStorage } from './WebStorage';
import type { Nip07, UnsignedEvent } from 'nostr-typedef';

declare const window: {
	nostr: Nip07.Nostr | undefined;
};

let bunkerSigner: BunkerSigner | undefined;
let nip46CachedPublicKey: string | undefined;

export class Signer {
	public static async establishBunkerConnection(bunker: string): Promise<void> {
		const bunkerPointer = await parseBunkerInput(bunker);
		if (!bunkerPointer) throw new Error(`Failed to parse bunker URL`);

		const storage = new WebStorage(localStorage);
		const clientSeckeyHex = storage.get('login:bunker:client-seckey');
		let clientSeckey: Uint8Array;
		if (clientSeckeyHex) {
			clientSeckey = hexToBytes(clientSeckeyHex);
		} else {
			clientSeckey = generateSecretKey();
			storage.set('login:bunker:client-seckey', bytesToHex(clientSeckey));
		}

		bunkerSigner = BunkerSigner.fromBunker(clientSeckey, bunkerPointer, {
			onauth: (url) => open(url, '_blank')
		});
		await bunkerSigner.connect();
		nip46CachedPublicKey = await bunkerSigner.getPublicKey();
	}

	public static async abolishBunkerConnection(): Promise<void> {
		if (bunkerSigner) {
			await bunkerSigner.close();
			bunkerSigner = undefined;
			nip46CachedPublicKey = undefined;
		}
	}

	public static async getPublicKey(): Promise<string> {
		const storage = new WebStorage(localStorage);
		const login = storage.get('login');
		if (login === null || login.startsWith('npub')) {
			throw new Error('[logic error]');
		}

		if (login === 'NIP-07' && window.nostr !== undefined) {
			return window.nostr.getPublicKey();
		} else if (login.startsWith('bunker://')) {
			return nip46CachedPublicKey!;
		} else if (login.startsWith('nsec')) {
			const { data: seckey } = nip19.decode(login);
			return getPublicKey(seckey as Uint8Array);
		} else {
			throw new Error('[logic error]');
		}
	}

	public static async signEvent(unsignedEvent: EventTemplate | UnsignedEvent): Promise<Event> {
		const storage = new WebStorage(localStorage);
		const login = storage.get('login');
		if (login === null || login.startsWith('npub')) {
			throw new Error('[logic error]');
		}

		if (login === 'NIP-07' && window.nostr !== undefined) {
			return await window.nostr.signEvent(unsignedEvent);
		} else if (login.startsWith('bunker://')) {
			return await bunkerSigner!.signEvent(unsignedEvent);
		} else if (login.startsWith('nsec')) {
			const { data: seckey } = nip19.decode(login);
			return finalizeEvent(unsignedEvent, seckey as Uint8Array);
		} else {
			throw new Error('[logic error]');
		}
	}

	public static async encrypt(pubkey: string, plaintext: string): Promise<string> {
		const storage = new WebStorage(localStorage);
		const login = storage.get('login');
		if (login === null || login.startsWith('npub')) {
			throw new Error('[logic error]');
		}

		if (login === 'NIP-07' && window.nostr !== undefined && window.nostr.nip04 !== undefined) {
			return await window.nostr.nip04.encrypt(pubkey, plaintext);
		} else if (login.startsWith('bunker://')) {
			return await bunkerSigner!.nip04Encrypt(pubkey, plaintext);
		} else if (login.startsWith('nsec')) {
			const { data: seckey } = nip19.decode(login);
			return await nip04.encrypt(seckey as string, pubkey, plaintext);
		} else {
			throw new Error('[logic error]');
		}
	}

	public static async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		const storage = new WebStorage(localStorage);
		const login = storage.get('login');
		if (login === null || login.startsWith('npub')) {
			throw new Error('[logic error]');
		}

		if (login === 'NIP-07' && window.nostr !== undefined && window.nostr.nip04 !== undefined) {
			return await window.nostr.nip04.decrypt(pubkey, ciphertext);
		} else if (login.startsWith('bunker://')) {
			return await bunkerSigner!.nip04Decrypt(pubkey, ciphertext);
		} else if (login.startsWith('nsec')) {
			const { data: seckey } = nip19.decode(login);
			return await nip04.decrypt(seckey as string, pubkey, ciphertext);
		} else {
			throw new Error('[logic error]');
		}
	}

	public static async encryptNip44(pubkey: string, plaintext: string): Promise<string> {
		const storage = new WebStorage(localStorage);
		const login = storage.get('login');
		if (login === null || login.startsWith('npub')) {
			throw new Error('[logic error]');
		}

		if (login === 'NIP-07' && window.nostr !== undefined && window.nostr.nip44 !== undefined) {
			return await window.nostr.nip44.encrypt(pubkey, plaintext);
		} else if (login.startsWith('bunker://')) {
			return await bunkerSigner!.nip44Encrypt(pubkey, plaintext);
		} else if (login.startsWith('nsec')) {
			const result = nip19.decode(login);
			if (result.type !== 'nsec') {
				throw new Error('[logic error]');
			}
			const seckey = result.data;
			const conversationKey = nip44.getConversationKey(seckey, pubkey);
			return await nip44.encrypt(plaintext, conversationKey);
		} else {
			throw new Error('[logic error]');
		}
	}

	public static async decryptNip44(pubkey: string, ciphertext: string) {
		const storage = new WebStorage(localStorage);
		const login = storage.get('login');
		if (login === null || login.startsWith('npub')) {
			throw new Error('[logic error]');
		}

		if (login === 'NIP-07' && window.nostr !== undefined && window.nostr.nip44 !== undefined) {
			return await window.nostr.nip44.decrypt(pubkey, ciphertext);
		} else if (login.startsWith('bunker://')) {
			return await bunkerSigner!.nip44Decrypt(pubkey, ciphertext);
		} else if (login.startsWith('nsec')) {
			const result = nip19.decode(login);
			if (result.type !== 'nsec') {
				throw new Error('[logic error]');
			}
			const seckey = result.data;
			const conversationKey = nip44.getConversationKey(seckey, pubkey);
			return await nip44.decrypt(ciphertext, conversationKey);
		} else {
			throw new Error('[logic error]');
		}
	}
}
