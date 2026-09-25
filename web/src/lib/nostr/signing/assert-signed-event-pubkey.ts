import type * as Nostr from 'nostr-typedef';

export function assertSignedEventPubkey(
	event: Pick<Nostr.Event, 'pubkey'>,
	accountPubkey: string
): void {
	if (event.pubkey !== accountPubkey) {
		throw new Error('Signed event pubkey does not match the publication account');
	}
}
