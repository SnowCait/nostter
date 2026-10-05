import { createRxOneshotReq, uniq } from 'rx-nostr';
import { lastValueFrom, map, toArray } from 'rxjs';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import { rxNostr } from '$lib/relay-client';
import { tie } from '$lib/nostr/relay/relay-hints';

export async function fetchAddressDeletionRequests(
	pubkey: string,
	addresses: readonly string[]
): Promise<Nostr.Event[]> {
	const req = createRxOneshotReq({
		filters: [{ kinds: [Kind.EventDeletion], authors: [pubkey], '#a': [...addresses] }]
	});
	return lastValueFrom(
		rxNostr.use(req).pipe(
			tie,
			uniq(),
			map(({ event }) => event),
			toArray()
		)
	);
}
