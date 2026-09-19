import { isValidPubkey } from './pubkey';

export interface FollowEntry {
	pubkey: string;
	relayUrl?: string;
	petname?: string;
}

export function parseFollowList(tags: string[][]): FollowEntry[] {
	return tags.flatMap((tag): FollowEntry[] => {
		const [name, pubkey, relayUrl, petname] = tag;
		if (name !== 'p' || !isValidPubkey(pubkey)) return [];

		return [
			{
				pubkey,
				relayUrl: relayUrl || undefined,
				petname: petname || undefined
			}
		];
	});
}
