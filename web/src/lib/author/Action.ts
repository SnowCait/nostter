import { get, writable } from 'svelte/store';
import { batch, createRxBackwardReq, uniq } from 'rx-nostr';
import { bufferTime, bufferWhen, filter, interval } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { filterTags } from '$lib/EventHelper';
import type { id } from '$lib/Types';
import { pubkey } from '../../stores/Author';
import { maxFilters } from '$lib/Constants';

export const repostedEventIds = writable(new Set<id>());

export function updateRepostedEvents(events: Event[]): void {
	const ids = events.flatMap((event) => filterTags('e', event.tags));
	const $repostedEventIds = get(repostedEventIds);
	for (const id of ids) {
		$repostedEventIds.add(id);
	}
	repostedEventIds.set($repostedEventIds);
}

const repostReq = createRxBackwardReq();
rxNostr
	.use(repostReq.pipe(bufferTime(500, null, maxFilters), batch()))
	.pipe(
		uniq(),
		bufferWhen(() => interval(500)),
		filter((packets) => packets.length > 0)
	)
	.subscribe((packets) => {
		console.debug('[rx-nostr repost next]', packets);
		updateRepostedEvents(packets.map(({ event }) => event));
	});
export function repostReqEmit(event: Event): void {
	const ids = [event.id, ...filterTags('e', event.tags)];
	console.debug('[rx-nostr repost req]', ids);
	const $pubkey = get(pubkey);
	repostReq.emit([
		{
			kinds: [6],
			authors: [$pubkey],
			'#e': ids
		}
	]);
}
