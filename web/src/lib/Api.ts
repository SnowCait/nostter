import { nip19, type Event, type SimplePool, Kind, type Filter } from 'nostr-tools';
import { get } from 'svelte/store';
import type { Event as NostrEvent, UserEvent } from '../routes/types';
import { cachedEvents, events as timelineEvents } from '../stores/Events';
import { saveMetadataEvent, userEvents } from '../stores/UserEvents';
import { isMuteEvent } from '../stores/Author';

export class Api {
	constructor(private pool: SimplePool, private relays: string[]) {}

	async fetchAuthorEvents(pubkey: string): Promise<[Map<Kind, Event>, Map<string, Event>]> {
		// Load cache
		const cachedReplaceableEvents = sessionStorage.getItem('nostter:replaceable-events');
		const cachedParameterizedReplaceableEvents = sessionStorage.getItem(
			'nostter:parameterized-replaceable-events'
		);
		if (cachedReplaceableEvents !== null && cachedParameterizedReplaceableEvents !== null) {
			return [
				new Map<Kind, Event>(
					[...Object.entries(JSON.parse(cachedReplaceableEvents))].map(([k, e]) => [
						Number(k) as Kind,
						e as Event
					])
				),
				new Map<string, Event>(
					Object.entries(JSON.parse(cachedParameterizedReplaceableEvents))
				)
			];
		}

		const events = await this.pool.list(this.relays, [
			{
				kinds: [
					Kind.Metadata,
					Kind.RecommendRelay,
					Kind.Contacts,
					10000,
					Kind.RelayList,
					30000,
					30078
				],
				authors: [pubkey]
			}
		]);
		events.sort((x, y) => x.created_at - y.created_at); // Latest event is effective
		console.debug('[author events all]', events);
		const threshold = 30000;
		const replaceableEvents = new Map<Kind, Event>(
			events.filter((e) => e.kind < threshold).map((e) => [e.kind, e])
		);
		const parameterizedReplaceableEvents = new Map<string, Event>(
			events
				.filter((e) => e.kind >= threshold)
				.map((e) => {
					const id = e.tags
						.find(
							([tagName, tagContent]) => tagName === 'd' && tagContent !== undefined
						)
						?.at(1);
					if (id === undefined) {
						return null;
					}
					return [`${e.kind}:${id}`, e];
				})
				.filter((x): x is [string, Event] => x !== null)
		);
		console.log('[author events]', replaceableEvents, parameterizedReplaceableEvents);

		// Save cache
		sessionStorage.setItem(
			'nostter:replaceable-events',
			JSON.stringify(Object.fromEntries(replaceableEvents))
		);
		sessionStorage.setItem(
			'nostter:parameterized-replaceable-events',
			JSON.stringify(Object.fromEntries(parameterizedReplaceableEvents))
		);

		return [replaceableEvents, parameterizedReplaceableEvents];
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
				kinds: [0],
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

	async fetchEvent(filters: Filter[]): Promise<Event | undefined> {
		const events = await this.pool.list(this.relays, filters);
		if (events.length === 0) {
			return undefined;
		}

		// Latest
		events.sort((x, y) => y.created_at - x.created_at);
		const event = events[0];

		if (isMuteEvent(event)) {
			return undefined;
		}

		return event;
	}

	async fetchEventById(id: string): Promise<NostrEvent | undefined> {
		// If exsits in store
		const $events = get(timelineEvents);
		const storedEvent = $events.find((x) => x.id === id);
		if (storedEvent !== undefined) {
			return storedEvent;
		}
		const $cachedEvents = get(cachedEvents);
		const cachedEvent = $cachedEvents.get(id);
		if (cachedEvent !== undefined) {
			return cachedEvent;
		}

		// Fetch event
		const event = await this.fetchEvent([
			{
				ids: [id]
			}
		]);

		if (event === undefined) {
			console.log('[id not found]', id, nip19.noteEncode(id), nip19.neventEncode({ id }));
			return undefined;
		}

		const userEvent = await this.fetchUserEvent(event.pubkey);
		if (userEvent === undefined) {
			return event as NostrEvent;
		}

		// Return
		const nostrEvent = event as NostrEvent;
		nostrEvent.user = userEvent.user;

		// Cache
		$cachedEvents.set(nostrEvent.id, nostrEvent);

		return nostrEvent;
	}

	async fetchContactListEvent(pubkey: string): Promise<Event | undefined> {
		const events = await this.pool.list(this.relays, [
			{
				kinds: [3],
				authors: [pubkey],
				limit: 1 // Some relays have multi kind 3
			}
		]);
		events.sort((x, y) => y.created_at - x.created_at);
		console.log('[contact list events]', events);
		return events.length > 0 ? events[0] : undefined;
	}

	async fetchFollowees(pubkey: string): Promise<string[]> {
		const event = await this.fetchContactListEvent(pubkey);
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

	async fetchChannelMetadataEvent(id: string): Promise<Event | undefined> {
		const events = await this.pool.list(this.relays, [
			{
				kinds: [Kind.ChannelMetadata],
				'#e': [id],
				limit: 1
			}
		]);
		events.sort((x, y) => y.created_at - x.created_at);
		console.debug('[channel metadata events]', events);
		return events.at(0);
	}

	async publish(event: Event): Promise<boolean> {
		return new Promise((resolve) => {
			const publishedRelays = new Map<string, boolean>();
			const now = Date.now();

			const done = () => Array.from(publishedRelays).some(([, ok]) => ok);

			setTimeout(() => {
				console.warn(
					'[publish timeout]',
					this.relays,
					publishedRelays,
					`${Date.now() - now}ms`
				);
				resolve(done());
			}, 3000);

			const pub = this.pool.publish(this.relays, event);
			pub.on('ok', (relay: string) => {
				console.log('[ok]', relay, `${Date.now() - now}ms`);
				publishedRelays.set(relay, true);
				if (this.relays.length === publishedRelays.size) {
					resolve(done());
				}
			});
			pub.on('failed', (relay: string) => {
				console.warn('[failed]', relay, `${Date.now() - now}ms`);
				publishedRelays.set(relay, false);
				if (this.relays.length === publishedRelays.size) {
					resolve(done());
				}
			});
		});
	}
}
