import { get, writable } from 'svelte/store';
import { batch, createRxBackwardReq, filterByKind, uniq, type LazyFilter } from 'rx-nostr';
import { bufferTime, bufferWhen, filter, interval, share } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { rxNostr, tie } from '$lib/timelines/MainTimeline';
import { maxFilters } from '$lib/Constants';
import { filterTags, findReactionToId } from '$lib/EventHelper';
import type { id } from '$lib/Types';
import { pubkey } from '../stores/Author';
import { deletedEventIdsByPubkey, storeDeletedEvents } from './Delete';
import { Reaction } from 'nostr-tools/kinds';

export const repostedEventIds = writable(new Set<id>());
export const reactionedEvents = writable(new Map<id, Event[]>());

export function updateRepostedEvents(events: Event[]): void {
	const ids = events.flatMap((event) => filterTags('e', event.tags));
	const $repostedEventIds = get(repostedEventIds);
	for (const id of ids) {
		$repostedEventIds.add(id);
	}
	repostedEventIds.set($repostedEventIds);
}

export function updateReactionedEvents(events: Event[]): void {
	const $reactionedEvents = get(reactionedEvents);
	for (const event of events.filter(
		(event) => event.kind === Reaction && event.pubkey === get(pubkey) // Ensure
	)) {
		const id = findReactionToId(event.tags);
		if (id === undefined) {
			continue;
		}

		const reactionEvents = $reactionedEvents.get(id) ?? [];
		if (reactionEvents.some((e) => e.id === event.id)) {
			continue;
		}

		reactionEvents.push(event);
		$reactionedEvents.set(id, reactionEvents);
	}
	reactionedEvents.set($reactionedEvents);
}

const authorActionReq = createRxBackwardReq();
const observable = rxNostr
	.use(authorActionReq.pipe(bufferTime(500, null, maxFilters / 2), batch()))
	.pipe(tie, uniq(), share());
observable.pipe(filterByKind(5)).subscribe(({ event }) => {
	console.debug('[deleted]', event);
	storeDeletedEvents(event);
});
observable
	.pipe(
		filterByKind(6),
		bufferWhen(() => interval(500)),
		filter((packets) => packets.length > 0)
	)
	.subscribe((packets) => {
		console.debug('[rx-nostr author repost next]', packets);
		updateRepostedEvents(packets.map(({ event }) => event));
	});
observable
	.pipe(
		filterByKind(7),
		bufferWhen(() => interval(500)),
		filter((packets) => packets.length > 0)
	)
	.subscribe((packets) => {
		console.debug('[rx-nostr author reaction next]', packets);
		updateReactionedEvents(packets.map(({ event }) => event));
	});
export function authorActionReqEmit(event: Event): void {
	const ids = [event.id, ...filterTags('e', event.tags)];
	console.debug('[rx-nostr author action req]', ids);
	const $pubkey = get(pubkey);
	const filters: LazyFilter[] = [
		{
			kinds: [6, 7],
			authors: [$pubkey],
			'#e': ids
		}
	];
	const $deletedEventIdsByPubkey = get(deletedEventIdsByPubkey);
	const $deletedEventIds = $deletedEventIdsByPubkey.get(event.pubkey);
	if ($deletedEventIds === undefined || !$deletedEventIds.has(event.id)) {
		// TODO: Move file because this is not author action
		filters.push({
			kinds: [5],
			authors: [event.pubkey],
			'#e': [event.id]
		});
	}
	authorActionReq.emit(filters);
}
