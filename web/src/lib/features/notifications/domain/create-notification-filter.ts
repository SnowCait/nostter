import type * as Nostr from 'nostr-typedef';
import { notificationsFilterKinds } from '$lib/Constants';
import { isValidPubkey } from '$lib/nostr/protocol/pubkey';

export function createNotificationFilter(
	pubkey: unknown,
	since: number,
	until: number
): Nostr.Filter | undefined {
	if (!isValidPubkey(pubkey)) {
		return undefined;
	}

	return {
		kinds: notificationsFilterKinds,
		'#p': [pubkey],
		until,
		since
	};
}
