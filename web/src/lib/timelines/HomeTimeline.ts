import { createRxForwardReq, filterByKind, latestEach, now, uniq } from 'rx-nostr';
import { filter, share, tap } from 'rxjs';
import type { Filter } from 'nostr-typedef';
import { referencesReqEmit, rxNostr } from './MainTimeline';
import { WebStorage } from '$lib/WebStorage';
import { Kind } from 'nostr-tools';
import { get } from 'svelte/store';
import { bookmarkEvent } from '$lib/author/Bookmark';
import { updateReactionedEvents, updateRepostedEvents } from '$lib/author/Action';
import { authorChannelsEventStore, storeMetadata } from '$lib/cache/Events';
import { updateFolloweesStore } from '$lib/Contacts';
import { findIdentifier } from '$lib/EventHelper';
import { Preferences, preferencesStore } from '$lib/Preferences';
import { followingHashtags, updateFollowingHashtags } from '$lib/Interest';
import { EventItem } from '$lib/Items';
import { ToastNotification } from '$lib/ToastNotification';
import { authorReplaceableKinds } from '$lib/Author';
import { chunk } from '$lib/Array';
import { filterLimitItems, parameterizedReplaceableKinds, replaceableKinds } from '$lib/Constants';
import { Mute } from '$lib/Mute';
import { updateUserStatus, userStatusReqEmit } from '$lib/UserStatus';
import { pubkey, author, updateRelays, followees } from '../../stores/Author';
import { lastReadAt, notifiedEventItems, unreadEventItems } from '../../stores/Notifications';
import { events, eventsPool } from '../../stores/Events';
import { saveLastNote } from '../../stores/LastNotes';
import { autoRefresh } from '../../stores/Preference';

export let hasSubscribed = false;

const streamingSpeed = new Map<number, number>();
let streamingSpeedNotifiedAt = now();

const homeTimelineReq = createRxForwardReq();
const observable = rxNostr.use(homeTimelineReq).pipe(uniq());

// Author Replaceable Events
const authorReplaceableObservable = observable.pipe(
	filter(({ event }) => replaceableKinds.includes(event.kind)),
	filter(({ event }) => event.pubkey === get(pubkey)), // Ensure
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
authorReplaceableObservable
	.pipe(filterByKind(Kind.Metadata))
	.subscribe(({ event }) => storeMetadata(event));
authorReplaceableObservable.pipe(filterByKind(Kind.Contacts)).subscribe(({ event }) => {
	updateFolloweesStore(event.tags);
	hometimelineReqEmit();
});
authorReplaceableObservable.pipe(filterByKind(10000)).subscribe(async ({ event }) => {
	await new Mute().update(event);
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
	.subscribe(({ event }) => get(author)?.storeCustomEmojis(event));

// Author Parameterized Replaceable Events
const authorParameterizedReplaceableObservable = observable.pipe(
	filter(({ event }) => parameterizedReplaceableKinds.includes(event.kind)),
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

authorParameterizedReplaceableObservable.pipe(filterByKind(30001)).subscribe(({ event }) => {
	if (findIdentifier(event.tags) === 'bookmark') {
		bookmarkEvent.set(event);
	}
});
authorParameterizedReplaceableObservable.pipe(filterByKind(30078)).subscribe(({ event }) => {
	const identifier = findIdentifier(event.tags);
	if (identifier === 'nostter-read') {
		lastReadAt.set(event.created_at);
		unreadEventItems.set([]);
	} else if (identifier === 'nostter-preferences') {
		const preferences = new Preferences(event.content);
		preferencesStore.set(preferences);
	}
});

// Other Events
observable
	.pipe(
		filter(
			({ event }) =>
				!replaceableKinds.includes(event.kind) &&
				!parameterizedReplaceableKinds.includes(event.kind)
		)
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

		// Streaming speed (experimental)
		notifyStreamingSpeed(event.created_at);

		if (get(events).some((x) => x.event.id === packet.event.id)) {
			console.warn('[rx-nostr home timeline duplicate]', packet.event);
			return;
		}

		const eventItem = new EventItem(event);

		// Notification
		if ($author?.isNotified(event)) {
			console.log('[related]', event);

			const $unreadEventItems = get(unreadEventItems);
			const $notifiedEventItems = get(notifiedEventItems);

			if ($notifiedEventItems.some((x) => x.event.id === event.id)) {
				console.warn('[rx-nostr notification timeline duplicate (home)]', event);
			} else {
				$unreadEventItems.unshift(eventItem);
				$notifiedEventItems.unshift(eventItem);
				unreadEventItems.set($unreadEventItems);
				notifiedEventItems.set($notifiedEventItems);

				const toast = new ToastNotification();
				toast.notify(event);
			}
		}

		if (get(autoRefresh)) {
			const $events = get(events);
			$events.unshift(eventItem);
			events.set($events);
		} else {
			const $eventsPool = get(eventsPool);
			$eventsPool.unshift(eventItem);
			eventsPool.set($eventsPool);
		}

		// Cache
		if (event.kind === Kind.Text) {
			saveLastNote(event);
		}

		// User Status
		if (!get(followees).includes(event.pubkey)) {
			userStatusReqEmit(event.pubkey);
		}
	});

function notifyStreamingSpeed(createdAt: number): void {
	if (window.Notification === undefined || Notification.permission !== 'granted') {
		return;
	}

	const time = Math.floor(createdAt / 60);
	let count = streamingSpeed.get(time);
	count = (count ?? 0) + 1;
	streamingSpeed.set(time, count);

	const last5minutes = [
		streamingSpeed.get(time - 1) ?? 0,
		streamingSpeed.get(time - 2) ?? 0,
		streamingSpeed.get(time - 3) ?? 0,
		streamingSpeed.get(time - 4) ?? 0,
		streamingSpeed.get(time - 5) ?? 0
	];
	const average = last5minutes.reduce((x, y) => x + y) / last5minutes.length;
	console.debug('[speed]', time, count, average, streamingSpeed, last5minutes);

	if (
		count > average * 2 &&
		count > 10 &&
		createdAt > streamingSpeedNotifiedAt + last5minutes.length * 60
	) {
		streamingSpeedNotifiedAt = createdAt;
		new Notification('Hot timeline!');
	}
}

export function hometimelineReqEmit() {
	console.log('[home timeline subscribe]');

	hasSubscribed = true;

	const $pubkey = get(pubkey);
	const $followees = get(followees);
	const since = now();

	const followeesFilter: Filter[] = chunk($followees, filterLimitItems).map((chunkedAuthors) => {
		return {
			kinds: [Kind.Metadata, Kind.Text, 6, Kind.ChannelCreation, Kind.ChannelMessage, 30315],
			authors: chunkedAuthors,
			since
		};
	});
	console.log('[rx-nostr subscribe followees filter]', followeesFilter);

	const relatesFilter: Filter = {
		kinds: [
			Kind.Text,
			Kind.EncryptedDirectMessage,
			6,
			Kind.Reaction,
			Kind.BadgeAward,
			Kind.ChannelMessage,
			Kind.Zap
		],
		'#p': [$pubkey],
		since
	};

	const authorFilters: Filter[] = [
		{
			kinds: [...new Set(authorReplaceableKinds.map(({ kind }) => kind))],
			authors: [$pubkey]
		},
		{
			kinds: [Kind.Reaction],
			authors: [$pubkey],
			since
		}
	];
	const $followingHashtags = get(followingHashtags);
	if ($followingHashtags.length > 0) {
		authorFilters.push({
			kinds: [Kind.Text],
			'#t': $followingHashtags,
			since
		});
	}
	console.log('[rx-nostr subscribe author filter]', authorFilters);
	homeTimelineReq.emit([...followeesFilter, relatesFilter, ...authorFilters]);
}
