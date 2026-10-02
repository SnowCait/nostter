import type { Event } from 'nostr-tools/core';
import { Contacts } from 'nostr-tools/kinds';
import {
	EMPTY,
	Observable,
	ReplaySubject,
	catchError,
	defer,
	filter,
	finalize,
	from,
	merge,
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

	function remembered(pubkey: string): Observable<Event> {
		const latest = latestByPubkey.get(pubkey);
		return latest === undefined ? EMPTY : of(latest);
	}

	function refresh(pubkey: string): Observable<Event> {
		const cached = defer(() => from(dependencies.getCachedFolloweeEvent(pubkey))).pipe(
			catchError((error) => {
				console.warn('[follow list cache read failed]', error);
				return of(undefined);
			}),
			filter((event) => event !== undefined),
			filter((event) => remember(pubkey, event))
		);
		const relay = dependencies.request(pubkey).pipe(
			filter((event) => remember(pubkey, event)),
			tap({
				next: (event) => dependencies.cache(event),
				complete: () => {
					refreshedPubkeys.add(pubkey);
				}
			})
		);
		const shared = merge(
			defer(() => remembered(pubkey)),
			cached,
			relay
		).pipe(
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
				return remembered(pubkey);
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
