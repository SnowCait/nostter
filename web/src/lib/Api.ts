import { nip19, type Event, type SimplePool } from 'nostr-tools';
import { get } from 'svelte/store';
import type { Event as NostrEvent, User, UserEvent } from '../routes/types';
import { events } from '../stores/Events';
import { saveUserEvent, userEvents } from '../stores/UserEvents';

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
		const metadata = await this.pool.get(this.relays, {
			kinds: [0],
			authors: [pubkey]
		});
		if (metadata === null) {
			console.log(
				`pubkey: ${nip19.npubEncode(pubkey)} not found in ${this.relays.join(', ')}`
			);
			return undefined;
		}

		const user = JSON.parse(metadata.content) as User;
		userEvent = metadata as UserEvent;
		userEvent.user = user;

		// Save cache
		saveUserEvent(userEvent);

		return userEvent;
	}

	async fetchEvent(id: string): Promise<NostrEvent | undefined> {
		// If exsits in store
		const $events = get(events);
		const storedEvent = $events.find((x) => x.id === id);
		if (storedEvent !== undefined) {
			return storedEvent;
		}

		// Fetch event
		const event = await this.pool.get(this.relays, {
			kinds: [1],
			ids: [id]
		});
		if (event === null) {
			console.log(`id: ${id} not found in ${this.relays.join(', ')}`);
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

	async publish(event: Event): Promise<boolean> {
		return new Promise((resolve) => {
			const publishedRelays = new Map<string, boolean>();
			const now = Date.now();

			const done = () => Array.from(publishedRelays).some(([, ok]) => ok);

			setTimeout(() => {
				console.warn('[publish timeout]', this.relays, publishedRelays, `${Date.now() - now}ms`);
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
