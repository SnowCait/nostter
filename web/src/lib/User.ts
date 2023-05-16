import { nip19 } from 'nostr-tools';
import type { ProfilePointer } from 'nostr-tools/lib/nip19';

export class User {
	static async decode(slug: string): Promise<{ pubkey: string | undefined; relays: string[] }> {
		console.debug('[slug]', slug);

		let pubkey: string | undefined = undefined;
		let relays: string[] = [];

		try {
			if (/^[\w-.]+@[\w-.]+$/.test(slug)) {
				const [name, domain] = slug.split('@');
				const response = await fetch(
					`https://${domain}/.well-known/nostr.json?name=${name}`
				);
				if (!response.ok) {
					console.error('[invalid NIP-05]', await response.text());
					throw new Error('fetch failed');
				}
				const data = await response.json();
				console.log('[NIP-05]', data);
				pubkey = data.names[name];
				relays = data.relays?.[name] ?? [];
			} else {
				const { type, data } = nip19.decode(slug);
				switch (type) {
					case 'npub': {
						pubkey = data as string;
						break;
					}
					case 'nprofile': {
						const pointer = data as ProfilePointer;
						pubkey = pointer.pubkey;
						relays = pointer.relays ?? [];
						break;
					}
					default: {
						break;
					}
				}
			}
		} catch (error) {
			console.error('[decode failed]', slug, error);
		}

		console.debug('[decoded]', slug, pubkey, relays);

		return {
			pubkey,
			relays
		};
	}
}
