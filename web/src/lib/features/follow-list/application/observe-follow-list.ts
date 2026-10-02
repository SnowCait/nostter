import type { Event } from 'nostr-tools/core';
import { Contacts } from 'nostr-tools/kinds';
import {
	EMPTY,
	Observable,
	ReplaySubject,
	concat,
	defer,
	filter,
	finalize,
	from,
	map,
	of,
	share,
	tap
} from 'rxjs';
import { auth } from '$lib/auth.svelte';
import { cacheFolloweeReplaceableEvent, followeeEventCache } from '$lib/cache/Events';
import { shouldReplaceCurrentEvent } from '$lib/nostr/protocol/replaceable-event';
import { requestLatestReplaceableEvent } from '$lib/nostr/relay/event-operations';

type Dependencies = {
	getCachedFolloweeEvent(pubkey: string): Promise<Event | undefined>;
	request(pubkey: string): Observable<Event>;
	cache(event: Event): void;
};

export function createFollowListObserver(
	dependencies: Dependencies
): (pubkey: string) => Observable<Event> {
	const latestByPubkey = new Map<string, Event>();
	const refreshedPubkeys = new Set<string>();
	const inFlightByPubkey = new Map<string, Observable<Event>>();

	function remember(pubkey: string, event: Event): boolean {
		if (!shouldReplaceCurrentEvent(event, latestByPubkey.get(pubkey))) {
			return false;
		}
		latestByPubkey.set(pubkey, event);
		return true;
	}

	function refresh(pubkey: string): Observable<Event> {
		const initial = defer(() => from(dependencies.getCachedFolloweeEvent(pubkey))).pipe(
			map((cached) => {
				if (cached !== undefined) {
					remember(pubkey, cached);
				}
				return latestByPubkey.get(pubkey);
			}),
			filter((event) => event !== undefined)
		);
		const relay = dependencies.request(pubkey).pipe(
			filter((event) => remember(pubkey, event)),
			tap((event) => dependencies.cache(event))
		);
		const shared = concat(initial, relay).pipe(
			tap({
				complete: () => {
					refreshedPubkeys.add(pubkey);
				}
			}),
			finalize(() => {
				if (inFlightByPubkey.get(pubkey) === shared) {
					inFlightByPubkey.delete(pubkey);
				}
			}),
			share({ connector: () => new ReplaySubject<Event>(1) })
		);
		inFlightByPubkey.set(pubkey, shared);
		return shared;
	}

	return (pubkey) =>
		defer(() => {
			if (refreshedPubkeys.has(pubkey)) {
				const latest = latestByPubkey.get(pubkey);
				return latest === undefined ? EMPTY : of(latest);
			}
			return inFlightByPubkey.get(pubkey) ?? refresh(pubkey);
		});
}

export const observeFollowList = createFollowListObserver({
	getCachedFolloweeEvent: async (pubkey) => {
		if (!auth.followeesSet.has(pubkey)) {
			return undefined;
		}
		return (await followeeEventCache.getLatest(Contacts, [pubkey])).get(pubkey);
	},
	request: (pubkey) => requestLatestReplaceableEvent(Contacts, pubkey),
	cache: cacheFolloweeReplaceableEvent
});
