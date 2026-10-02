import type { Event } from 'nostr-tools/core';
import { Contacts } from 'nostr-tools/kinds';
import {
	Observable,
	ReplaySubject,
	defer,
	filter,
	finalize,
	from,
	of,
	share,
	switchMap,
	tap
} from 'rxjs';
import { accountAddressableEventCache, cacheAccountEvent } from '$lib/cache/Events';
import { parseFollowList } from '$lib/nostr/protocol/nip02';
import { shouldReplaceCurrentEvent } from '$lib/nostr/protocol/replaceable-event';
import { requestLatestReplaceableEvent } from '$lib/nostr/relay/event-operations';

type Dependencies = {
	getCached(pubkey: string): Promise<Event | undefined>;
	request(pubkey: string): Observable<Event>;
	cache(event: Event): Promise<boolean>;
};

export function createFollowListObserver(
	dependencies: Dependencies
): (pubkey: string) => Observable<Event> {
	const inFlight = new Map<string, Observable<Event>>();

	function request(pubkey: string): Observable<Event> {
		const current = inFlight.get(pubkey);
		if (current !== undefined) {
			return current;
		}

		const writes: Promise<unknown>[] = [];
		let completed = false;
		const release = () => {
			if (inFlight.get(pubkey) === shared) {
				inFlight.delete(pubkey);
			}
		};
		const shared = dependencies.request(pubkey).pipe(
			tap({
				next: (event) => {
					writes.push(
						dependencies.cache(event).catch((error) => {
							console.warn('[profile preview follow list cache failed]', error);
						})
					);
				},
				complete: () => {
					completed = true;
				}
			}),
			finalize(() => {
				// Keep sharing the completed result until the cache can serve it.
				if (completed) {
					void Promise.allSettled(writes).then(release);
				} else {
					release();
				}
			}),
			share({ connector: () => new ReplaySubject<Event>(1), resetOnComplete: false })
		);
		inFlight.set(pubkey, shared);
		return shared;
	}

	return (pubkey) =>
		defer(() => {
			let latest: Event | undefined;
			return from(dependencies.getCached(pubkey)).pipe(
				switchMap((cached) => (cached !== undefined ? of(cached) : request(pubkey))),
				filter((event) => {
					if (!shouldReplaceCurrentEvent(event, latest)) {
						return false;
					}
					latest = event;
					return true;
				})
			);
		});
}

export const observeFollowList = createFollowListObserver({
	getCached: (pubkey) => accountAddressableEventCache.get(pubkey, Contacts),
	request: (pubkey) => requestLatestReplaceableEvent(Contacts, pubkey),
	cache: cacheAccountEvent
});

export function isFollowing(followList: Event, pubkey: string): boolean {
	return parseFollowList(followList.tags).some((entry) => entry.pubkey === pubkey);
}
