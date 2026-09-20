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

	get nip04(): Nostr.Nip07.Nip04Crypto | undefined {
		return window.nostr?.nip04;
	}

	get nip44(): Nostr.Nip07.Nip44Crypto | undefined {
		return window.nostr?.nip44;
	}
}
