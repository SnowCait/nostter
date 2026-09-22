import { get } from 'svelte/store';
import { now } from 'rx-nostr';
import { isAddressableKind, isReplaceableKind } from 'nostr-tools/kinds';
import type * as Nostr from 'nostr-typedef';
import { pubkey as authorPubkey } from '$lib/stores/Author';
import { rxNostr } from '$lib/nostr/relay/client';
import { getEventAddress } from '$lib/nostr/protocol/event-address';
import type { Signer } from '$lib/nostr/signing/signer';

export async function requestEventDeletion(
	signEvent: Signer['signEvent'],
	events: readonly Nostr.Event[],
	reason = ''
): Promise<void> {
	if (events.length === 0) {
		throw new Error('Deletion request requires at least one target event');
	}

	const accountPubkey = get(authorPubkey);
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}
	if (events.some((event) => event.pubkey !== accountPubkey)) {
		throw new Error('Cannot request deletion of an event by another author');
	}

	const targetTags = new Map<string, string[]>();
	for (const event of events) {
		const tag =
			isReplaceableKind(event.kind) || isAddressableKind(event.kind)
				? ['a', getEventAddress(event)]
				: ['e', event.id];
		targetTags.set(`${tag[0]}:${tag[1]}`, tag);
	}

	const event = await signEvent({
		kind: 5,
		pubkey: accountPubkey,
		content: reason,
		tags: [
			...targetTags.values(),
			...[...new Set(events.map((event) => event.kind))].map((kind) => ['k', `${kind}`])
		],
		created_at: now()
	});
	const { promise, resolve, reject } = Promise.withResolvers<void>();
	let accepted = false;
	rxNostr.send(event).subscribe({
		next: ({ eventId, from, ok }) => {
			console.debug('[delete send]', eventId, from, ok);
			if (ok && !accepted) {
				accepted = true;
				resolve();
			}
		},
		error: reject,
		complete: () => {
			if (!accepted) {
				reject(new Error('Deletion request was not accepted by any relay'));
			}
		}
	});
	return promise;
}
