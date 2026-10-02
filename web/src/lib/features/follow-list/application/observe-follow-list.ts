import type { Event } from 'nostr-tools/core';
import { Contacts } from 'nostr-tools/kinds';
import {
	EMPTY,
	Observable,
	ReplaySubject,
	catchError,
	defer,
	filter,
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
	const sessions = new Map<string, Observable<Event>>();

	function createSession(pubkey: string): Observable<Event> {
		let latest: Event | undefined;
		const cached = defer(() => dependencies.getCachedFolloweeEvent(pubkey)).pipe(
			catchError((error) => {
				console.warn('[follow list cache read failed]', error);
				return of(undefined);
			}),
			filter((event) => event !== undefined)
		);
		const relay = defer(() => dependencies.request(pubkey)).pipe(
			tap((event) => dependencies.cache(event))
		);
		const newer = merge(cached, relay).pipe(
			filter((event) => {
				if (!shouldReplaceCurrentEvent(event, latest)) {
					return false;
				}
				latest = event;
				return true;
			})
		);

		// The request is finite, so it runs to completion without subscribers; only an error
		// resets the session so that the next subscriber retries from the latest event.
		return defer(() => merge(latest === undefined ? EMPTY : of(latest), newer)).pipe(
			share({
				connector: () => new ReplaySubject<Event>(1),
				resetOnError: true,
				resetOnComplete: false,
				resetOnRefCountZero: false
			})
		);
	}

	return (pubkey) => {
		let session = sessions.get(pubkey);
		if (session === undefined) {
			session = createSession(pubkey);
			sessions.set(pubkey, session);
		}
		return session;
	};
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
