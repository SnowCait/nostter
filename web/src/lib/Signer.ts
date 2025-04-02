import {
	getEventHash,
	type Event,
	signEvent,
	nip19,
	type EventTemplate,
	getPublicKey,
	nip04
} from 'nostr-tools';
import { WebStorage } from './WebStorage';
import type { UnsignedEvent } from 'nostr-typedef';

interface Window {
	// NIP-07
	nostr: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
declare const window: Window;

export class Signer {
	public static async getPublicKey(): Promise<string> {
		const storage = new WebStorage(localStorage);
		const login = storage.get('login');
		if (login === null || login.startsWith('npub')) {
			throw new Error('[logic error]');
		}

		if (login === 'NIP-07') {
			return await window.nostr.getPublicKey();
		} else if (login.startsWith('nsec')) {
			const { data: seckey } = nip19.decode(login);
			return getPublicKey(seckey as string);
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

		if (login === 'NIP-07') {
			return await window.nostr.signEvent(unsignedEvent);
		} else if (login.startsWith('nsec')) {
			const { data: seckey } = nip19.decode(login);
			const event = unsignedEvent as Event;
			if (event.pubkey === undefined) {
				event.pubkey = getPublicKey(seckey as string);
			}
			event.id = getEventHash(event);
			event.sig = signEvent(event, seckey as string);
			return event;
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

		if (login === 'NIP-07' && window.nostr.nip04 !== undefined) {
			return await window.nostr.nip04.encrypt(pubkey, plaintext);
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

		if (login === 'NIP-07' && window.nostr.nip04 !== undefined) {
			return await window.nostr.nip04.decrypt(pubkey, ciphertext);
		} else if (login.startsWith('nsec')) {
			const { data: seckey } = nip19.decode(login);
			return await nip04.decrypt(seckey as string, pubkey, ciphertext);
		} else {
			throw new Error('[logic error]');
		}
	}
}
