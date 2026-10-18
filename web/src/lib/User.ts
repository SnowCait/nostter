import { isPublicRelayUrl } from '@nostter/nostr-kit';
import { nip19 } from 'nostr-tools';
import { queryProfile } from 'nostr-tools/nip05';
import { isValidPubkey } from './nostr/protocol/pubkey';

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
				const profile = await queryProfile(slug);
				if (isValidPubkey(profile?.pubkey)) {
					pubkey = profile.pubkey;
					relays = profile.relays ?? [];
				}
			}
		} catch {
			// Fall through with pubkey undefined
		}

		return {
			pubkey,
			relays: (Array.isArray(relays) ? relays : []).filter(isPublicRelayUrl)
		};
	}
}
