import {
	createRxForwardReq,
	filterAsync,
	filterByKind,
	filterByKinds,
	latestEach,
	now,
	uniq
} from 'rx-nostr';
import { filter, share, tap } from 'rxjs';
import type { Filter } from 'nostr-typedef';
import { referencesReqEmit, rxNostr, storeSeenOn, tie } from './MainTimeline';
import { WebStorage } from '$lib/WebStorage';
import { kinds as Kind } from 'nostr-tools';
import { get, writable } from 'svelte/store';
import { bookmarkEvent } from '$lib/author/Bookmark';
import { updateReactionedEvents, updateRepostedEvents } from '$lib/author/Action';
import { storeCustomEmojis } from '$lib/author/CustomEmojis';
import { profileBadgesEvent } from '$lib/author/ProfileBadges';
import { authorChannelsEventStore, storeMetadata } from '$lib/cache/Events';
import { updateFolloweesStore } from '$lib/Contacts';
import { findIdentifier } from '$lib/EventHelper';
import { Preferences, preferencesStore } from '$lib/Preferences';
import { followingHashtags, updateFollowingHashtags } from '$lib/Interest';
import { EventItem } from '$lib/Items';
import { ToastNotification } from '$lib/ToastNotification';
import { chunk } from '$lib/Array';
import {
	homeFolloweesFilterKinds,
	filterLimitItems,
	parameterizedReplaceableKinds,
	replaceableKinds,
	authorFilterReplaceableKinds,
	authorFilterKinds,
	authorHashtagsFilterKinds,
	notificationsFilterKinds
} from '$lib/Constants';
import { updateUserStatus, userStatusReqEmit } from '$lib/UserStatus';
import {
	pubkey,
	author,
	updateRelays,
	followees,
	storeMutedPubkeysByKind,
	storeMutedTagsByEvent
} from '../stores/Author';
import { lastReadAt, notifiedEventItems } from '../author/Notifications';
import { events, eventsPool } from '../stores/Events';
import { saveLastNote } from '../stores/LastNotes';
import { autoRefresh } from '../stores/Preference';
import { isPeopleList, storePeopleList } from '$lib/author/PeopleLists';
import { storeDeletedEvents } from '$lib/author/Delete';

export let hasSubscribed = false;
export const activeAt = writable(now());

const homeTimelineReq = createRxForwardReq();
const observable = rxNostr.use(homeTimelineReq).pipe(tie, uniq(), share());

// Author Replaceable Events
const authorReplaceableObservable = observable.pipe(
	filterByKinds(replaceableKinds),
	filter(({ event }) => event.pubkey === get(pubkey)),
	latestEach(({ event }) => event.kind),
	filter(({ event }) => {
		const storage = new WebStorage(localStorage);
		const cache = storage.getReplaceableEvent(event.kind);
		return cache === undefined || cache.created_at < event.created_at;
	}),
	tap(({ event }) => {
		console.debug('[rx-nostr author replaceable event]', event.kind, event);
		const storage = new WebStorage(localStorage);
		storage.setReplaceableEvent(event);
	}),
	share()
);
authorReplaceableObservable.pipe(filterByKind(Kind.Contacts)).subscribe(({ event }) => {
	updateFolloweesStore(event.tags);
	hometimelineReqEmit();
});
authorReplaceableObservable.pipe(filterByKind(10000)).subscribe(async ({ event }) => {
	await storeMutedTagsByEvent(event);
});
authorReplaceableObservable
	.pipe(filterByKind(10001))
	.subscribe(({ event }) => authorChannelsEventStore.set(event));
authorReplaceableObservable
	.pipe(filterByKind(10005))
	.subscribe(({ event }) => authorChannelsEventStore.set(event));
authorReplaceableObservable
	.pipe(filterByKind(Kind.RelayList))
	.subscribe(({ event }) => updateRelays(event));
authorReplaceableObservable.pipe(filterByKind(10015)).subscribe(() => {
	updateFollowingHashtags();
	hometimelineReqEmit();
});
authorReplaceableObservable
	.pipe(filterByKind(10030))
	.subscribe(({ event }) => storeCustomEmojis(event));

// Author Parameterized Replaceable Events
const authorParameterizedReplaceableObservable = observable.pipe(
	filterByKinds(parameterizedReplaceableKinds),
	filter(({ event }) => event.pubkey === get(pubkey)), // Ensure
	latestEach(({ event }) => `${event.kind}:${findIdentifier(event.tags) ?? ''}`),
	filter(({ event }) => {
		const storage = new WebStorage(localStorage);
		const cache = storage.getParameterizedReplaceableEvent(
			event.kind,
			findIdentifier(event.tags) ?? ''
		);
		return cache === undefined || cache.created_at < event.created_at;
	}),
	tap(({ event }) => {
		console.debug(
			'[rx-nostr author parameterized replaceable event]',
			event.kind,
			findIdentifier(event.tags),
			event
		);
		const storage = new WebStorage(localStorage);
		storage.setParameterizedReplaceableEvent(event);
	}),
	share()
);

authorParameterizedReplaceableObservable
	.pipe(
		filterByKind(30000),
		filterAsync(({ event }) => isPeopleList(event))
	)
	.subscribe(async ({ event }) => {
		storePeopleList(event);
	});
authorParameterizedReplaceableObservable.pipe(filterByKind(30001)).subscribe(({ event }) => {
	if (findIdentifier(event.tags) === 'bookmark') {
		bookmarkEvent.set(event);
	}
});
authorParameterizedReplaceableObservable.pipe(filterByKind(30007)).subscribe(({ event }) => {
	console.debug('[mute by kind event]', event);
	storeMutedPubkeysByKind([event]);
});
authorParameterizedReplaceableObservable.pipe(filterByKind(30008)).subscribe(({ event }) => {
	console.debug('[badge profile]', event);
	profileBadgesEvent.set(event);
});
authorParameterizedReplaceableObservable.pipe(filterByKind(30078)).subscribe(({ event }) => {
	const identifier = findIdentifier(event.tags);
	if (identifier === 'nostter-read') {
		console.debug('[last read at]', new Date(event.created_at * 1000));
		lastReadAt.set(event.created_at);
	} else if (identifier === 'nostter-preferences') {
		const preferences = new Preferences(event.content);
		preferencesStore.set(preferences);
	}
});

// Metadata
observable
	.pipe(
		filterByKind(Kind.Metadata),
		latestEach(({ event }) => event.pubkey),
		tap(({ event }) => console.debug('[rx-nostr metadata event]', event.kind, event))
	)
	.subscribe(({ event }) => storeMetadata(event));

// Other Events
observable.pipe(filterByKind(5)).subscribe(({ event }) => {
	console.debug('[deleted]', event);
	storeDeletedEvents(event);
});
observable
	.pipe(
		filterByKinds([...replaceableKinds, ...parameterizedReplaceableKinds, 5], { not: true }),
		tap(({ event, from }) => storeSeenOn(event.id, from))
	)
	.subscribe(async (packet) => {
		console.log('[rx-nostr subscribe home timeline]', packet);

		const { event } = packet;
		const $pubkey = get(pubkey);
		const $author = get(author);

		if ($author === undefined) {
			throw new Error('Logic error');
		}

		if (event.kind === 6 && event.pubkey === $pubkey) {
			updateRepostedEvents([event]);
		}

		if (event.kind === 7 && event.pubkey === $pubkey) {
			updateReactionedEvents([event]);
		}

		if (event.kind === 30315) {
			console.log('[user status]', event, packet.from);
			updateUserStatus(event);
			return;
		}

		referencesReqEmit(event);

		if (get(events).some((x) => x.event.id === packet.event.id)) {
			console.warn('[rx-nostr home timeline duplicate]', packet.event);
			return;
		}

		const eventItem = new EventItem(event);

		// Notification
		if ($author?.isNotified(event)) {
			console.log('[related]', event);

			const $notifiedEventItems = get(notifiedEventItems);

			if ($notifiedEventItems.some((x) => x.event.id === event.id)) {
				console.warn('[rx-nostr notification timeline duplicate (home)]', event);
			} else {
				$notifiedEventItems.unshift(eventItem);
				notifiedEventItems.set($notifiedEventItems);

				const toast = new ToastNotification();
				toast.notify(event);
			}
		}

		if (get(autoRefresh)) {
			const $events = get(events);
			const $activeAt = get(activeAt);
			if (eventItem.event.created_at > $activeAt) {
				$events.unshift(eventItem);
			} else {
				const index = $events.findIndex(
					(x) => x.event.created_at < eventItem.event.created_at
				);
				if (index < 0) {
					$events.unshift(eventItem);
				} else {
					$events.splice(index, 0, eventItem);
				}
			}
			events.set($events);
		} else {
			const $eventsPool = get(eventsPool);
			$eventsPool.unshift(eventItem);
			eventsPool.set($eventsPool);
		}

		// Cache
		if (event.kind === Kind.ShortTextNote) {
			saveLastNote(event);
		}

		// User Status
		if (!get(followees).includes(event.pubkey)) {
			userStatusReqEmit(event.pubkey);
		}
	});

export function hometimelineReqEmit() {
	console.log('[home timeline subscribe]');

	hasSubscribed = true;

	const $pubkey = get(pubkey);
	const $followees = get(followees);
	const since = now();

	const followeesFilter: Filter[] = chunk($followees, filterLimitItems).map((chunkedAuthors) => {
		return {
			kinds: homeFolloweesFilterKinds,
			authors: chunkedAuthors,
			since
		};
	});
	console.log('[rx-nostr subscribe followees filter]', followeesFilter);

	const notificationsFilter: Filter = {
		kinds: notificationsFilterKinds,
		'#p': [$pubkey],
		since
	};

	const authorFilters: Filter[] = [
		{
			kinds: authorFilterReplaceableKinds,
			authors: [$pubkey]
		},
		{
			kinds: authorFilterKinds,
			authors: [$pubkey],
			since
		}
	];
	const $followingHashtags = get(followingHashtags);
	if ($followingHashtags.length > 0) {
		authorFilters.push({
			kinds: authorHashtagsFilterKinds,
			'#t': $followingHashtags,
			since
		});
	}
	console.log('[rx-nostr subscribe author filter]', authorFilters);
	homeTimelineReq.emit([...followeesFilter, notificationsFilter, ...authorFilters]);
}
