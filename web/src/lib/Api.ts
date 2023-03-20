import type { SimplePool } from 'nostr-tools';
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
			console.log(`pubkey: ${pubkey} not found in ${this.relays.join(', ')}`);
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
}
