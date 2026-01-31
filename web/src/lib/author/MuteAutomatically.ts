import { get, writable } from 'svelte/store';
import { createRxBackwardReq, latestEach, uniq } from 'rx-nostr';
import type { Event } from 'nostr-typedef';
import { chunk } from '$lib/Array';
import { filterLimit, maxFilters } from '$lib/Constants';
import { rxNostr, tie } from '$lib/timelines/MainTimeline';
import { followees } from '$lib/stores/Author';

export const followeesOfFollowees = writable<Set<string>>(new Set());

const contactsOfFollowees = writable<Map<string, Event>>(new Map());
contactsOfFollowees.subscribe((events) => {
	if (events.size === 0) {
		return;
	}

	const $followees = get(followees);
	const pubkeys = [...events]
		.flatMap(([, event]) =>
			event.tags.filter(([t, pubkey]) => t === 'p' && typeof pubkey === 'string')
		)
		.map(([, pubkey]) => pubkey);
	followeesOfFollowees.set(new Set([...$followees, ...pubkeys]));
	console.debug('[followees followees]', get(followeesOfFollowees));
});

let loaded = false;
export function contactsOfFolloweesReqEmit(): void {
	const $contactsOfFollowees = get(contactsOfFollowees);
	if (loaded) {
		return; // Already fetched
	}

	loaded = true;

	const req = createRxBackwardReq();
	rxNostr
		.use(req)
		.pipe(
			tie,
			uniq(),
			latestEach(({ event }) => event.pubkey)
		)
		.subscribe({
			next: ({ event }) => {
				console.debug('[followees contacts]', event);
				$contactsOfFollowees.set(event.pubkey, event);
			},
			complete: () => {
				contactsOfFollowees.set($contactsOfFollowees);
			}
		});

	const $followees = get(followees);
	followeesOfFollowees.set(new Set($followees)); // For UX
	const filters = chunk($followees, filterLimit).map((authors) => ({ kinds: [3], authors }));
	for (const chunkedFilters of chunk(filters, maxFilters)) {
		req.emit(chunkedFilters);
		req.over();
	}
}
