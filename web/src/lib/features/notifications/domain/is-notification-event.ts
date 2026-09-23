import type * as Nostr from 'nostr-typedef';

export function isNotificationEvent(event: Nostr.Event, accountPubkey: string): boolean {
	return (
		event.pubkey !== accountPubkey &&
		event.tags.some(([tagName, tagContent]) => tagName === 'p' && tagContent === accountPubkey)
	);
}
