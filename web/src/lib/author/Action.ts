import { get, writable } from 'svelte/store';
import { batch, createRxBackwardReq, filterByKind, uniq } from 'rx-nostr';
import { bufferTime, bufferWhen, filter, interval } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { maxFilters } from '$lib/Constants';
import { filterTags, findReactionToId } from '$lib/EventHelper';
import type { id } from '$lib/Types';
import { pubkey } from '../stores/Author';

export const repostedEventIds = writable(new Set<id>());
export const reactionedEventIds = writable(new Set<id>());

export function updateRepostedEvents(events: Event[]): void {
	const ids = events.flatMap((event) => filterTags('e', event.tags));
	const $repostedEventIds = get(repostedEventIds);
	for (const id of ids) {
		$repostedEventIds.add(id);
	}
	repostedEventIds.set($repostedEventIds);
}

export function updateReactionedEvents(events: Event[]): void {
	const ids = events
		.map((event) => findReactionToId(event.tags))
		.filter((id): id is string => id !== undefined);
	const $reactionedEventIds = get(reactionedEventIds);
	for (const id of ids) {
		$reactionedEventIds.add(id);
	}
	reactionedEventIds.set($reactionedEventIds);
}

const authorActionReq = createRxBackwardReq();
const observable = rxNostr
	.use(authorActionReq.pipe(bufferTime(500, null, maxFilters), batch()))
	.pipe(uniq());
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
	authorActionReq.emit([
		{
			kinds: [6, 7],
			authors: [$pubkey],
			'#e': ids
		}
	]);
}
