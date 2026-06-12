import { nip19 } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';

export class User {
	static async decode(slug: string): Promise<{ pubkey: string | undefined; relays: string[] }> {
		let pubkey: string | undefined = undefined;
		let relays: string[] = [];

		try {
			if (slug.startsWith('npub1') || slug.startsWith('nprofile1')) {
				const { type, data } = nip19.decode(slug);
				switch (type) {
					case 'npub': {
						pubkey = data as string;
						break;
					}
					case 'nprofile': {
						const pointer = data as nip19.ProfilePointer;
						pubkey = pointer.pubkey;
						relays = pointer.relays ?? [];
						break;
					}
					default: {
						break;
					}
				}
			} else {
				const match = slug.match(/^(?:([\w-.]+)@)?([\w-.]+)$/);
				if (match === null) {
					throw new Error(`${slug} doesn't match NIP-05`);
				}
				const [, name = '_', domain] = match;
				const url = `https://${domain}/.well-known/nostr.json?name=${name}`;
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error('fetch failed');
				}
				const data = (await response.json()) as Nostr.Nip05.NostrAddress;
				pubkey = Object.entries(data.names).find(
					([key]) => key.toLowerCase() === name.toLowerCase()
				)?.[1];
				if (pubkey !== undefined) {
					relays = data.relays?.[pubkey] ?? [];
				}
			}
		} catch {
			// Fall through with pubkey undefined
		}

		return {
			pubkey,
			relays
		};
	}
}
