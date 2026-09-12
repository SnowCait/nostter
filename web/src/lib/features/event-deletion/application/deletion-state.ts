import { get, writable } from 'svelte/store';
import type * as Nostr from 'nostr-typedef';
import { filterTags } from '$lib/EventHelper';

export const deletedEventIdsByPubkey = writable(new Map<string, Set<string>>());

export function markEventsDeleted(event: Nostr.Event): void {
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
