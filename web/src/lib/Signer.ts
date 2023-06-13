import {
	getEventHash,
	type Event,
	signEvent,
	nip19,
	type EventTemplate,
	getPublicKey,
	nip04
} from 'nostr-tools';

interface Window {
	// NIP-07
	nostr: any;
}
declare var window: Window;

export class Signer {
	public static getPublicKey(): string {
		const login = localStorage.getItem('nostter:login');
		if (login === null || login.startsWith('npub')) {
			throw new Error('[logic error]');
		}

		if (login === 'NIP-07') {
			return window.nostr.getPublicKey();
		} else if (login.startsWith('nsec')) {
			const { data: seckey } = nip19.decode(login);
			return getPublicKey(seckey as string);
		} else {
			throw new Error('[logic error]');
		}
	}

	public static async signEvent(unsignedEvent: EventTemplate): Promise<Event> {
		const login = localStorage.getItem('nostter:login');
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

	public static getRelays(): Map<string, { read: boolean; write: boolean }> {
		const login = localStorage.getItem('nostter:login');
		if (login === 'NIP-07') {
			try {
				return window.nostr.getRelays();
			} catch (error) {
				console.error('[NIP-07 getRelays()]', error);
				return new Map();
			}
		} else {
			return new Map();
		}
	}

	public static async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		const login = localStorage.getItem('nostter:login');
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
