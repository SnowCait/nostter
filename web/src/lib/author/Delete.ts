import { get, writable } from 'svelte/store';
import { now } from 'rx-nostr';
import type * as Nostr from 'nostr-typedef';
import { pubkey as authorPubkey } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Signer } from '$lib/Signer';
import { filterTags } from '$lib/EventHelper';
import { filter, firstValueFrom } from 'rxjs';

export const deletedEventIds = writable(new Set<string>());
export const deletedEventIdsByPubkey = writable(new Map<string, Set<string>>());
export const deletedEventCoordinates = writable(new Set<string>());

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

export async function deleteAddressableEvent(
	kind: number,
	pubkey: string,
	identifier: string,
	reason = ''
): Promise<Nostr.Event> {
	const $authorPubkey = get(authorPubkey);
	if (pubkey !== $authorPubkey) throw new Error("Cannot delete another author's event.");
	const coordinate = `${kind}:${pubkey}:${identifier}`;
	const event = await Signer.signEvent({
		kind: 5,
		pubkey: $authorPubkey,
		content: reason,
		tags: [
			['a', coordinate],
			['k', `${kind}`]
		],
		created_at: now()
	});
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));
	deletedEventCoordinates.update((coordinates) => new Set(coordinates).add(coordinate));
	return event;
}

export async function deleteEvent(events: Nostr.Event[], reason = ''): Promise<void> {
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
