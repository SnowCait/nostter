import { nip19, type Event, type SimplePool, Kind, type Filter } from 'nostr-tools';
import { get } from 'svelte/store';
import { authorActionReqEmit } from './author/Action';
import type { UserEvent } from '../routes/types';
import { events as timelineEvents } from '../stores/Events';
import { saveMetadataEvent, userEvents } from '../stores/UserEvents';
import { EventItem } from './Items';
import { Content } from './Content';
import { Signer } from './Signer';
import { channelMetadataEventsStore, eventItemStore } from './cache/Events';
import { cachedEvents as newCachedEvents } from './cache/Events';
import { chronological, reverseChronological } from './Constants';
import { referencesReqEmit } from './timelines/MainTimeline';
import { sleep } from './Helper';

export class Api {
	constructor(private pool: SimplePool, private relays: string[]) {}

	public async fetchRelayEvents(pubkey: string): Promise<Map<Kind, Event>> {
		const events = await this.pool.list(this.relays, [
			{
				kinds: [Kind.Contacts, Kind.RelayList],
				authors: [pubkey]
			}
		]);
		events.sort(chronological); // Latest event is effective
		console.debug('[relay events all]', events);
		return new Map<Kind, Event>(events.map((e) => [e.kind, e]));
	}

	async fetchUserEvent(pubkey: string): Promise<UserEvent | undefined> {
		// Load cache
		const cachedUserEvents = get(userEvents);
		let userEvent = cachedUserEvents.get(pubkey);
		if (userEvent !== undefined) {
			return userEvent;
		}

		// Fetch metadata
		const event = await this.fetchEvent([
			{
				kinds: [Kind.Metadata],
				authors: [pubkey]
			}
		]);

		if (event === undefined) {
			console.log('[pubkey not found]', pubkey, nip19.npubEncode(pubkey));
			return undefined;
		}

		// Save cache
		userEvent = await saveMetadataEvent(event);

		return userEvent;
	}

	async fetchUserEventsMap(pubkeys: string[]): Promise<Map<string, UserEvent>> {
		const eventsMap = new Map<string, UserEvent>();

		if (pubkeys.length === 0) {
			return eventsMap;
		}

		const $userEvents = get(userEvents);
		for (const pubkey of pubkeys) {
			const userEvent = $userEvents.get(pubkey);
			if (userEvent !== undefined) {
				eventsMap.set(pubkey, userEvent);
			}
		}

		if (pubkeys.length === eventsMap.size) {
			return eventsMap;
		}

		const events = await this.fetchMetadataEventsMap(
			pubkeys.filter((pubkey) => !eventsMap.has(pubkey))
		);

		for (const [, event] of events) {
			const cache = eventsMap.get(event.pubkey);
			if (cache === undefined || cache.created_at < event.created_at) {
				const userEvent = await saveMetadataEvent(event);
				eventsMap.set(event.pubkey, userEvent);
			}
		}

		return eventsMap;
	}

	async fetchMetadataEventsMap(pubkeys: string[]): Promise<Map<string, Event>> {
		const eventsMap = new Map<string, Event>();

		if (pubkeys.length === 0) {
			return eventsMap;
		}

		const $userEvents = get(userEvents);
		for (const pubkey of pubkeys) {
			const userEvent = $userEvents.get(pubkey);
			if (userEvent !== undefined) {
				eventsMap.set(pubkey, userEvent as Event);
			}
		}

		if (pubkeys.length === eventsMap.size) {
			return eventsMap;
		}

		const events = await this.pool.list(this.relays, [
			{
				kinds: [Kind.Metadata],
				authors: pubkeys.filter((pubkey) => !eventsMap.has(pubkey))
			}
		]);

		for (const event of events) {
			const cache = eventsMap.get(event.pubkey);
			if (cache === undefined || cache.created_at < event.created_at) {
				eventsMap.set(event.pubkey, event);
			}
		}

		await Promise.all([...eventsMap].map(async ([, event]) => await saveMetadataEvent(event)));

		return eventsMap;
	}

	async fetchEvent(filters: Filter[]): Promise<Event | undefined> {
		const events = await this.pool.list(this.relays, filters);

		// Latest (return multi events except id filter)
		events.sort(reverseChronological);
		return events.at(0);
	}

	async fetchEventItemById(id: string): Promise<EventItem | undefined> {
		// If exists in store
		const $events = get(timelineEvents);
		const storedEventItem1 = $events.find((x) => x.event.id === id);
		if (storedEventItem1 !== undefined) {
			return storedEventItem1;
		}
		const $eventItemStore = get(eventItemStore);
		const storedEventItem2 = $eventItemStore.get(id);
		if (storedEventItem2 !== undefined) {
			return storedEventItem2;
		}

		// Fetch event
		const event = await this.pool.get(this.relays, {
			ids: [id]
		});

		if (event === null) {
			console.warn('[id not found]', id, nip19.noteEncode(id), nip19.neventEncode({ id }));
			return undefined;
		}

		referencesReqEmit(event);
		authorActionReqEmit(event);

		const eventItem = new EventItem(event);

		// Cache
		$eventItemStore.set(eventItem.event.id, eventItem);
		eventItemStore.set($eventItemStore);

		return eventItem;
	}

	async fetchContactsEvent(pubkey: string): Promise<Event | undefined> {
		const events = await this.pool.list(this.relays, [
			{
				kinds: [3],
				authors: [pubkey],
				limit: 1 // Some relays have duplicate kind 3
			}
		]);
		events.sort(reverseChronological);
		console.log('[contact list events]', events);
		return events.at(0);
	}

	async fetchBookmarkEvent(pubkey: string): Promise<Event | undefined> {
		return await this.fetchEvent([
			{
				authors: [pubkey],
				kinds: [30001],
				'#d': ['bookmark']
			}
		]);
	}

	async fetchEvents(filters: Filter[]): Promise<Event[]> {
		return this.pool.list(this.relays, filters);
	}

	// With metadata
	async fetchEventItems(filters: Filter[]): Promise<EventItem[]> {
		const events = await this.fetchEvents(filters);

		const referencedEventIds = new Set(
			events
				.map((x) => [
					...x.tags.filter(([tagName]) => tagName === 'e').map(([, id]) => id),
					...Content.findNotesAndNeventsToIds(x.content)
				])
				.flat()
		);
		const referencedEvents = await this.fetchEventsByIds([...referencedEventIds]);
		console.debug('[references events]', events.length, referencedEvents.length);

		for (const event of [...events, ...referencedEvents]) {
			referencesReqEmit(event);
			authorActionReqEmit(event);
			await sleep(0); // UI thread
		}

		events.sort(reverseChronological);
		const eventItems = events.map((event) => new EventItem(event));
		const referencedEventItems = referencedEvents.map((event) => new EventItem(event));

		// Cache events
		for (const item of [...eventItems, ...referencedEventItems]) {
			newCachedEvents.set(item.event.id, item.event);
		}
		console.debug('[cache]', events.length, referencedEventIds, newCachedEvents);

		return eventItems;
	}

	async fetchEventsByIds(ids: string[]): Promise<Event[]> {
		if (ids.length === 0) {
			return [];
		}

		return await this.fetchEvents([{ ids }]);
	}

	async fetchFollowees(pubkey: string): Promise<string[]> {
		const event = await this.fetchContactsEvent(pubkey);
		return Array.from(
			new Set(
				event?.tags.filter(([tagName]) => tagName === 'p').map(([, pubkey]) => pubkey) ?? []
			)
		);
	}

	async fetchFollowers(pubkey: string): Promise<string[]> {
		const events = await this.pool.list(this.relays, [
			{
				kinds: [3],
				'#p': [pubkey],
				limit: 1000
			}
		]);
		console.log('[followed contact list events]', events);
		return Array.from(new Set(events.map((x) => x.pubkey)));
	}

	/**
	 * @param id kind 40 id
	 * @returns kind 40 or 41 event
	 */
	async fetchChannelMetadataEvent(id: string): Promise<Event | undefined> {
		const $channelMetadataEventsStore = get(channelMetadataEventsStore);
		const cache = $channelMetadataEventsStore.get(id) ?? newCachedEvents.get(id);
		if (cache !== undefined) {
			console.debug('[channel metadata events cache]', cache);
			return cache;
		}

		const events = await this.pool.list(this.relays, [
			{
				kinds: [Kind.ChannelCreation],
				ids: [id],
				limit: 1
			},
			{
				kinds: [Kind.ChannelMetadata],
				'#e': [id],
				limit: 1
			}
		]);
		events.sort(reverseChronological);
		console.debug('[channel metadata events]', events);
		const event = events.at(0);
		if (event !== undefined) {
			if (event.kind === Kind.ChannelCreation) {
				newCachedEvents.set(id, event);
			} else if (event.kind === Kind.ChannelMetadata) {
				$channelMetadataEventsStore.set(id, event);
				channelMetadataEventsStore.set($channelMetadataEventsStore);
			} else {
				console.error('[channel metadata logic error]', event);
			}
		}
		return event;
	}

	public async signAndPublish(kind: Kind, content: string, tags: string[][]): Promise<Event> {
		const now = Date.now();
		const event = await Signer.signEvent({
			created_at: Math.round(now / 1000),
			kind,
			tags,
			content
		});
		console.log('[publish]', event);

		return new Promise((resolve, reject) => {
			const publishedRelays = new Map<string, boolean>();

			const timeoutId = setTimeout(() => {
				console.warn(
					'[publish timeout]',
					this.relays.filter((relay) => !publishedRelays.has(relay)),
					`${Date.now() - now}ms`
				);
				reject();
			}, this.pool['eoseSubTimeout']);

			const pub = this.pool.publish(this.relays, event);
			pub.on('ok', (relay: string) => {
				console.log('[ok]', relay, `${Date.now() - now}ms`);
				publishedRelays.set(relay, true);
				clearTimeout(timeoutId);
				resolve(event);
			});
			pub.on('failed', (relay: string) => {
				console.warn('[failed]', relay, `${Date.now() - now}ms`);
				publishedRelays.set(relay, false);
				if (this.relays.length === publishedRelays.size) {
					reject();
				}
			});
		});
	}

	close() {
		console.debug('[close connections]', this.relays);
		this.pool.close(this.relays);
	}
}
