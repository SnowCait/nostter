import { nip19, type Event, type SimplePool, Kind } from 'nostr-tools';
import { get } from 'svelte/store';
import type { Event as NostrEvent, UserEvent } from '../routes/types';
import { events as timelineEvents } from '../stores/Events';
import { saveMetadataEvent, userEvents } from '../stores/UserEvents';

export class Api {
	constructor(private pool: SimplePool, private relays: string[]) {}

	async fetchUserEvent(pubkey: string): Promise<UserEvent | undefined> {
		// From cache
		const cachedUserEvents = get(userEvents);
		let userEvent = cachedUserEvents.get(pubkey);
		if (userEvent !== undefined) {
			return userEvent;
		}

		// Fetch metadata
		const events = await this.pool.list(this.relays, [
			{
				kinds: [0],
				authors: [pubkey]
			}
		]);
		if (events.length === 0) {
			console.log(
				`pubkey: ${nip19.npubEncode(pubkey)} not found in ${this.relays.join(', ')}`
			);
			return undefined;
		}

		events.sort((x, y) => x.created_at - y.created_at);
		const metadata = events[0];

		// Save cache
		userEvent = saveMetadataEvent(metadata);

		return userEvent;
	}

	async fetchEvent(id: string): Promise<NostrEvent | undefined> {
		// If exsits in store
		const $events = get(timelineEvents);
		const storedEvent = $events.find((x) => x.id === id);
		if (storedEvent !== undefined) {
			return storedEvent;
		}

		// Fetch event
		const events = await this.pool.list(this.relays, [
			{
				kinds: [1],
				ids: [id]
			}
		]);
		if (events.length === 0) {
			console.log(`id: ${id} not found in ${this.relays.join(', ')}`);
			return undefined;
		}

		events.sort((x, y) => x.created_at - y.created_at);
		const event = events[0];

		if (isMuteEvent(event)) {
			return undefined;
		}

		const userEvent = await this.fetchUserEvent(event.pubkey);
		if (userEvent === undefined) {
			return event as NostrEvent;
		}

		// Return
		const nostrEvent = event as NostrEvent;
		nostrEvent.user = userEvent.user;
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
