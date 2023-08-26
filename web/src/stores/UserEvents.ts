import { writable, type Writable } from 'svelte/store';
import type { User, UserEvent } from '../routes/types';
import { nip57, type Event } from 'nostr-tools';
import { metadataEvents } from '$lib/cache/Events';

export const userEvents: Writable<Map<string, UserEvent>> = writable(new Map());
function saveUserEvent(userEvent: UserEvent) {
	userEvents.update((userEvents) => {
		const savedUserEvent = userEvents.get(userEvent.pubkey);

		if (savedUserEvent === undefined || savedUserEvent.created_at < userEvent.created_at) {
			userEvents.set(userEvent.pubkey, userEvent);
		}

		const cache = metadataEvents.get(userEvent.pubkey);
		if (cache === undefined || cache.created_at < userEvent.created_at) {
			metadataEvents.set(userEvent.pubkey, userEvent);
		}

		return userEvents;
	});
}
export async function saveMetadataEvent(event: Event): Promise<UserEvent> {
	try {
		const user = JSON.parse(event.content) as User;
		user.zapEndpoint = await nip57.getZapEndpoint(event);
		console.debug('[metadata]', user);
		const userEvent: UserEvent = {
			...event,
			user
		};
		saveUserEvent(userEvent);
		return userEvent;
	} catch (error) {
		console.warn('[invalid metadata]', error, event);
		return event as UserEvent;
	}
}
