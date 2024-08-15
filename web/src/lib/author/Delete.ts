import { get, writable } from 'svelte/store';
import { now } from 'rx-nostr';
import type { Event } from 'nostr-typedef';
import { pubkey as authorPubkey } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Signer } from '$lib/Signer';
import { filterTags } from '$lib/EventHelper';

export const deletedEventIds = writable(new Set<string>());
export const deletedEventIdsByPubkey = writable(new Map<string, Set<string>>());

export function storeDeletedEvents(event: Event): void {
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

export async function deleteEvent(events: Event[], reason = ''): Promise<void> {
	if (events.length === 0) {
		return;
	}

	const $authorPubkey = get(authorPubkey);
	if (events.some((event) => event.pubkey !== $authorPubkey)) {
		console.error('[delete logic error]', events);
		return;
	}

	const event = await Signer.signEvent({
		kind: 5,
		pubkey: $authorPubkey,
		content: reason,
		tags: [
			...events.map((event) => ['e', event.id]),
			...[...new Set(events.map((event) => event.kind))].map((kind) => ['k', `${kind}`])
		],
		created_at: now()
	});
	rxNostr.send(event).subscribe(({ eventId, from, ok }) => {
		console.debug('[delete send]', eventId, from, ok);
	});
}
