import { get, writable } from 'svelte/store';
import type * as Nostr from 'nostr-typedef';
import { filterTags } from '$lib/EventHelper';
import { AddressDeletions } from '../domain/address-deletions';

export const deletedEventIdsByPubkey = writable(new Map<string, Set<string>>());

const addressDeletions = new AddressDeletions();

export function markEventsDeleted(event: Nostr.Event): void {
	addressDeletions.add(event);

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

export function isDeletedByAddress(event: Nostr.Event): boolean {
	return addressDeletions.isDeleted(event);
}
