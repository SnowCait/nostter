import { unique } from '$lib/array';
import { pubkeysFromTags } from '$lib/pubkey';

export type FolloweeState = {
	originalFollowees: string[];
	followees: string[];
};

export function deriveFollowees(tags: string[][], accountPubkey: string): FolloweeState {
	const originalFollowees = pubkeysFromTags(tags);

	return {
		originalFollowees,
		followees: unique([...originalFollowees, accountPubkey])
	};
}
