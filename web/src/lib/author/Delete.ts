import { get, writable } from 'svelte/store';
import { now } from 'rx-nostr';
import { isAddressableKind, isReplaceableKind } from 'nostr-tools/kinds';
import type * as Nostr from 'nostr-typedef';
import { pubkey as authorPubkey } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Signer } from '$lib/Signer';
import { aTagContent, filterTags } from '$lib/EventHelper';

export const deletedEventIds = writable(new Set<string>());
export const deletedEventIdsByPubkey = writable(new Map<string, Set<string>>());

export function storeDeletedEvents(event: Nostr.Event): void {
	const pubkey = event.pubkey;
	const ids = filterTags('e', event.tags);

	if (ids.length > 0) {
		const $deletedEventIdsByPubkey = get(deletedEventIdsByPubkey);
		const $deletedEventIds = $deletedEventIdsByPubkey.get(pubkey);
		if ($deletedEventIds === undefined) {
			$deletedEventIdsByPubkey.set(pubkey, new Set(ids));
		} else {
			for (const id of ids) {
				$deletedEventIds.add(id);
			}
			$deletedEventIdsByPubkey.set(pubkey, $deletedEventIds);
		}
		deletedEventIdsByPubkey.set($deletedEventIdsByPubkey);
		console.debug('[delete ids store]', $deletedEventIds);
	}
}

export async function requestEventDeletion(
	events: readonly Nostr.Event[],
	reason = ''
): Promise<void> {
	if (events.length === 0) {
		throw new Error('Deletion request requires at least one target event');
	}

	const $authorPubkey = get(authorPubkey);
	if (events.some((event) => event.pubkey !== $authorPubkey)) {
		throw new Error('Cannot request deletion of an event by another author');
	}

	const targetTags = new Map<string, string[]>();
	for (const event of events) {
		const tag =
			isReplaceableKind(event.kind) || isAddressableKind(event.kind)
				? ['a', aTagContent(event)]
				: ['e', event.id];
		targetTags.set(`${tag[0]}:${tag[1]}`, tag);
	}

	const event = await Signer.signEvent({
		kind: 5,
		pubkey: $authorPubkey,
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
