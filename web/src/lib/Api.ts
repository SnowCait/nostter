import type { SimplePool } from 'nostr-tools';
import { get } from 'svelte/store';
import type { Event as NostrEvent, User, UserEvent } from '../routes/types';
import { events } from '../stores/Events';
import { saveUserEvent, userEvents } from '../stores/UserEvents';

export class Api {
	constructor(private pool: SimplePool, private relays: string[]) {}

	async fetchEvent(id: string): Promise<NostrEvent | undefined> {
		// If exsits in store
		const $events = get(events);
		const storedEvent = $events.find(x => x.id === id);
		if (storedEvent !== undefined) {
			return storedEvent;
		}

		// Fetch event
		const event = await this.pool.get(this.relays, {
			kinds: [1],
			ids: [id]
		});
		if (event === null) {
			return undefined;
		}

		const cachedUserEvents = get(userEvents);
		let userEvent = cachedUserEvents.get(event.pubkey);

		// Fetch metadata
		if (userEvent === undefined) {
			const metadata = await this.pool.get(this.relays, {
				kinds: [0],
				authors: [event.pubkey]
			});
			if (metadata === null) {
				console.log(`${event.pubkey} not found on ${event.id}`);
				return event as NostrEvent;
			}

			const user = JSON.parse(metadata.content) as User;
			userEvent = metadata as UserEvent;
			userEvent.user = user;

			// Save cache
			saveUserEvent(userEvent);
		}

		// Return
		const nostrEvent = event as NostrEvent;
		nostrEvent.user = userEvent.user;
		return nostrEvent;
	}
}
