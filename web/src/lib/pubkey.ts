import { unique } from './array';
import { isValidPubkey } from './nostr/protocol/pubkey';

export function pubkeysFromTags(tags: string[][]): string[] {
	return unique(
		tags.filter((tag) => tag[0] === 'p' && isValidPubkey(tag[1])).map((tag) => tag[1])
	);
}
