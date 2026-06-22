import { get, writable } from 'svelte/store';
import { createRxBackwardReq, latestEach, uniq } from 'rx-nostr';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import { chunk } from '$lib/Array';
import { filterLimit, maxFilters } from '$lib/Constants';
import { rxNostr, tie } from '$lib/timelines/MainTimeline';
import { followees } from '$lib/stores/Author';
import { cacheFolloweeReplaceableEvent, followeeEventCache } from '$lib/cache/Events';

export const followeesOfFollowees = writable<Set<string>>(new Set());

const contactsOfFollowees = writable<Map<string, Nostr.Event>>(new Map());
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

	const $followees = get(followees);
	followeesOfFollowees.set(new Set($followees)); // For UX

	followeeEventCache.getLatest(Kind.Contacts, $followees).then((cached) => {
		if (cached.size === 0) {
			return;
		}
		for (const [pubkey, event] of cached) {
			$contactsOfFollowees.set(pubkey, event);
		}
		contactsOfFollowees.set($contactsOfFollowees);
	});

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
				cacheFolloweeReplaceableEvent(event);
			},
			complete: () => {
				contactsOfFollowees.set($contactsOfFollowees);
			}
		});

	const filters = chunk($followees, filterLimit).map((authors) => ({
		kinds: [Kind.Contacts],
		authors
	}));
	for (const chunkedFilters of chunk(filters, maxFilters)) {
		req.emit(chunkedFilters);
		req.over();
	}
}
