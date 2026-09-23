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
}
