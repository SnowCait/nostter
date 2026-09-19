import { isValidPubkey } from './pubkey';

export interface FollowEntry {
	pubkey: string;
	relayUrl?: string;
	petname?: string;
}

function parseRelayUrl(value: string | undefined): string | undefined {
	if (value === undefined || value === '') return undefined;

	try {
		const { protocol } = new URL(value);
		return protocol === 'ws:' || protocol === 'wss:' ? value : undefined;
	} catch {
		return undefined;
	}
}

export function parseFollowList(tags: string[][]): FollowEntry[] {
	return tags.flatMap((tag): FollowEntry[] => {
		const [name, pubkey, relayUrl, petname] = tag;
		if (name !== 'p' || !isValidPubkey(pubkey)) return [];

		return [
			{
				pubkey,
				relayUrl: parseRelayUrl(relayUrl),
				petname: petname === '' ? undefined : petname
			}
		];
	});
}
