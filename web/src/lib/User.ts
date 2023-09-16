import { nip19 } from 'nostr-tools';
import type { ProfilePointer } from 'nostr-tools/lib/nip19';

export class User {
	static async decode(slug: string): Promise<{ pubkey: string | undefined; relays: string[] }> {
		console.debug('[slug]', slug);

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
						const pointer = data as ProfilePointer;
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
				console.log('[NIP-05 match]', match);
				if (match === null) {
					throw new Error(`${slug} doesn't match NIP-05`);
				}
				const [, name = '_', domain] = match;
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
