import {
	type Event,
	nip19,
	type EventTemplate,
	getPublicKey,
	nip04,
	finalizeEvent,
	generateSecretKey
} from 'nostr-tools';
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
import { WebStorage } from './WebStorage';
import type { Nip07, UnsignedEvent } from 'nostr-typedef';

declare const window: {
	nostr: Nip07.Nostr | undefined;
};

let bunkerSigner: BunkerSigner | undefined;
let nip46CachedPublicKey: string | undefined;

export class Signer {
	public static async establishBunkerConnection(bunker: string): Promise<void> {
		const bp = await parseBunkerInput(bunker);
		if (!bp) throw new Error(`failed to parse '${bunker}'`);

		const storage = new WebStorage(localStorage);
		let kss = storage.get('nip46clientSecret');
		let ks: Uint8Array;
		if (kss) {
			ks = hexToBytes(kss);
		} else {
			ks = generateSecretKey();
			storage.set('nip46clientSecret', bytesToHex(ks));
		}

		bunkerSigner = new BunkerSigner(ks, bp);
		nip46CachedPublicKey = await bunkerSigner.getPublicKey();
	}

	public static async getPublicKey(): Promise<string> {
		const storage = new WebStorage(localStorage);
		const login = storage.get('login');
		if (login === null || login.startsWith('npub')) {
			throw new Error('[logic error]');
		}

		if (login === 'NIP-07' && window.nostr !== undefined) {
			return await window.nostr.getPublicKey();
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
			return await bunkerSigner!.signEvent(unsignedEvent as any);
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
			return bunkerSigner!.nip04Encrypt(pubkey, plaintext);
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
			return bunkerSigner!.nip04Decrypt(pubkey, ciphertext);
		} else if (login.startsWith('nsec')) {
			const { data: seckey } = nip19.decode(login);
			return await nip04.decrypt(seckey as string, pubkey, ciphertext);
		} else {
			throw new Error('[logic error]');
		}
	}
}
