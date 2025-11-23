import { get, writable } from 'svelte/store';
import { batch, createRxBackwardReq, isExpired, uniq } from 'rx-nostr';
import { bufferTime, filter } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { rxNostr, tie } from './timelines/MainTimeline';
import { maxFilters } from './Constants';
import type { pubkey } from './Types';

export const userStatusesMap = writable(new Map<pubkey, Event[]>());

export const userStatusReq = createRxBackwardReq();
rxNostr
	.use(userStatusReq.pipe(bufferTime(1000, null, maxFilters), batch()))
	.pipe(
		tie,
		uniq(),
		filter(({ event }) => !isExpired(event))
	)
	.subscribe(({ event }) => updateUserStatus(event));

export function updateUserStatus(event: Event): void {
	const $userStatusesMap = get(userStatusesMap);
	const statuses = $userStatusesMap.get(event.pubkey);
	if (statuses === undefined) {
		$userStatusesMap.set(event.pubkey, [event]);
	} else {
		statuses.push(event);
		$userStatusesMap.set(
			event.pubkey,
			statuses.filter((status) => !isExpired(status))
		);
	}
	userStatusesMap.set($userStatusesMap);
}

export function userStatusReqEmit(pubkeys: pubkey[]): void {
	const $userStatusesMap = get(userStatusesMap);
	const authors = pubkeys.filter((pubkey) => !$userStatusesMap.has(pubkey));
	if (authors.length === 0) {
		return;
	}
	for (const pubkey of authors) {
		$userStatusesMap.set(pubkey, []);
	}
	userStatusesMap.set($userStatusesMap);
	userStatusReq.emit({ kinds: [30315], authors });
}
