import { createRxForwardReq, now, uniq } from 'rx-nostr';
import type { Filter } from 'nostr-typedef';
import { referencesReqEmit, rxNostr } from './MainTimeline';
import { WebStorage } from '$lib/WebStorage';
import { Kind } from 'nostr-tools';
import { get } from 'svelte/store';
import { bookmarkEvent } from '$lib/author/Bookmark';
import { updateReactionedEvents, updateRepostedEvents } from '$lib/author/Action';
import { authorChannelsEventStore, metadataStore } from '$lib/cache/Events';
import { updateFolloweesStore } from '$lib/Contacts';
import { findIdentifier } from '$lib/EventHelper';
import { Preferences, preferencesStore } from '$lib/Preferences';
import { followingHashtags, updateFollowingHashtags } from '$lib/Interest';
import { EventItem, Metadata } from '$lib/Items';
import { ToastNotification } from '$lib/ToastNotification';
import { authorReplaceableKinds } from '$lib/Author';
import { chunk } from '$lib/Array';
import { filterLimitItems } from '$lib/Constants';
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
rxNostr
	.use(homeTimelineReq)
	.pipe(uniq())
	.subscribe(async (packet) => {
		console.log('[rx-nostr subscribe home timeline]', packet);

		const { event } = packet;
		const $pubkey = get(pubkey);
		const $author = get(author);
		const storage = new WebStorage(localStorage);

		if ($author === undefined) {
			throw new Error('Logic error');
		}

		if (event.kind === Kind.Metadata) {
			if (event.pubkey === $pubkey) {
				storage.setReplaceableEvent(event);
			}

			const cache = get(metadataStore).get(event.pubkey);
			if (cache === undefined || cache.event.created_at < event.created_at) {
				const metadata = new Metadata(packet.event);
				console.log('[rx-nostr metadata]', packet, metadata.content?.name);
				const $metadataStore = get(metadataStore);
				$metadataStore.set(metadata.event.pubkey, metadata);
				metadataStore.set($metadataStore);
			}
			return;
		}

		if (event.kind === Kind.Contacts) {
			console.log('[contacts]', event, packet.from);
			storage.setReplaceableEvent(event);
			updateFolloweesStore(event.tags);
			hometimelineReqEmit();
			return;
		}

		if (event.kind === 6 && event.pubkey === $pubkey) {
			updateRepostedEvents([event]);
		}

		if (event.kind === 7 && event.pubkey === $pubkey) {
			updateReactionedEvents([event]);
		}

		if (event.kind === 10000) {
			console.log('[mute list]', event, packet.from);
			storage.setReplaceableEvent(event);
			await new Mute().update(event);
			return;
		}

		if (event.kind === 10001 || event.kind === 10005) {
			storage.setReplaceableEvent(event);
			authorChannelsEventStore.set(event);
			return;
		}

		if (event.kind === Kind.RelayList) {
			console.log('[relay list]', event, packet.from);
			storage.setReplaceableEvent(event);
			updateRelays(event);
			return;
		}

		if (event.kind === 10015) {
			console.log('[interest list]', event, packet.from);
			storage.setReplaceableEvent(event);
			updateFollowingHashtags();
			hometimelineReqEmit();
			return;
		}

		if (event.kind === 10030) {
			storage.setReplaceableEvent(event);
			$author?.storeCustomEmojis(event);
			return;
		}

		if (event.kind === 30000) {
			storage.setParameterizedReplaceableEvent(event);
			const identifier = findIdentifier(event.tags);
			if (identifier === 'notifications/lastOpened') {
				console.log('[last read]', event);
				lastReadAt.set(event.created_at);
				unreadEventItems.set([]);
			} else if (identifier !== undefined) {
				console.log('[people list]', event);
			}
			return;
		}

		if (event.kind === 30001) {
			console.debug('[list]', event, packet.from);
			storage.setParameterizedReplaceableEvent(event);
			if (findIdentifier(event.tags) === 'bookmark') {
				console.log('[bookmark]', event, packet.from);
				bookmarkEvent.set(event);
			}
			return;
		}

		if (event.kind === 30078) {
			console.log('[app data]', event, packet.from);
			storage.setParameterizedReplaceableEvent(event);

			const identifier = findIdentifier(event.tags);
			if (identifier === 'nostter-read') {
				console.log('[last read]', event);
				lastReadAt.set(event.created_at);
				unreadEventItems.set([]);
			} else if (identifier === 'nostter-preferences') {
				const preferences = new Preferences(event.content);
				preferencesStore.set(preferences);
			}

			return;
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

	const storage = new WebStorage(localStorage);
	const cachedAt = storage.getCachedAt();
	const sinceOfCache = cachedAt ?? now();
	const authorFilters: Filter[] = [
		{
			kinds: [...new Set(authorReplaceableKinds.map(({ kind }) => kind))],
			authors: [$pubkey],
			since: sinceOfCache
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
	console.log('[rx-nostr subscribe author filter]', authorFilters, new Date(sinceOfCache * 1000));
	homeTimelineReq.emit([...followeesFilter, relatesFilter, ...authorFilters]);
}
