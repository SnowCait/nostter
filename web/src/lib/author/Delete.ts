import { get, writable } from 'svelte/store';
import { now } from 'rx-nostr';
import type * as Nostr from 'nostr-typedef';
import { pubkey as authorPubkey } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Signer } from '$lib/Signer';
import { filterTags, findIdentifier } from '$lib/EventHelper';
import { filter, firstValueFrom } from 'rxjs';
import { kinds as Kind } from 'nostr-tools';
import { isAddressableKind } from 'nostr-tools/kinds';
import { fetchEvents } from '$lib/RxNostrHelper';
import { legacyBookmarkIdentifier } from '$lib/Constants';
import { WebStorage } from '$lib/WebStorage';

export const deletedEventIds = writable(new Set<string>());
export const deletedEventIdsByPubkey = writable(new Map<string, Set<string>>());
export const deletedEventCoordinates = writable(new Map<string, number>());

const addressableCoordinate = /^(\d+):([0-9a-f]{64}):(.*)$/;

export function isLegacyBookmarkEvent(event: Nostr.Event): boolean {
	return (
		event.kind === Kind.Genericlists && findIdentifier(event.tags) === legacyBookmarkIdentifier
	);
}

export async function restoreLegacyBookmarkDeletionState(
	pubkey: string,
	storage = new WebStorage(localStorage)
): Promise<void> {
	const coordinate = `${Kind.Genericlists}:${pubkey}:${legacyBookmarkIdentifier}`;
	const deletionRequests = await fetchEvents([
		{
			kinds: [5],
			authors: [pubkey],
			'#a': [coordinate]
		}
	]);
	for (const event of deletionRequests) {
		storeDeletedEvents(event);
	}
	removeDeletedLegacyBookmarkCache(storage);
}

export function removeDeletedLegacyBookmarkCache(storage = new WebStorage(localStorage)): void {
	const cached = storage.getParameterizedReplaceableEvent(
		Kind.Genericlists,
		legacyBookmarkIdentifier
	);
	if (cached !== undefined && isAddressableEventDeleted(cached)) {
		storage.removeParameterizedReplaceableEvent(Kind.Genericlists, legacyBookmarkIdentifier);
	}
}

function storeDeletedEventCoordinates(event: Nostr.Event): void {
	const coordinates = filterTags('a', event.tags).filter((coordinate) => {
		const match = addressableCoordinate.exec(coordinate);
		return match !== null && isAddressableKind(Number(match[1])) && match[2] === event.pubkey;
	});
	if (coordinates.length === 0) return;

	deletedEventCoordinates.update((stored) => {
		const updated = new Map(stored);
		for (const coordinate of coordinates) {
			updated.set(coordinate, Math.max(updated.get(coordinate) ?? 0, event.created_at));
		}
		return updated;
	});
}

export function isAddressableEventDeleted(event: Nostr.Event): boolean {
	const identifier = event.tags.find(([name]) => name === 'd')?.[1] ?? '';
	const deletedAt = get(deletedEventCoordinates).get(
		`${event.kind}:${event.pubkey}:${identifier}`
	);
	return deletedAt !== undefined && event.created_at <= deletedAt;
}

export function isDeletedLegacyBookmarkEvent(event: Nostr.Event): boolean {
	return isLegacyBookmarkEvent(event) && isAddressableEventDeleted(event);
}

export function storeDeletedEvents(event: Nostr.Event): void {
	storeDeletedEventCoordinates(event);
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
	storeDeletedEventCoordinates(event);
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
