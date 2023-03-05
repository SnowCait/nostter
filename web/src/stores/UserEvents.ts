import { writable, type Writable } from 'svelte/store';
import type { UserEvent } from '../routes/types';

export const userEvents: Writable<Map<string, UserEvent>> = writable(new Map());
export function saveUserEvent(userEvent: UserEvent) {
	userEvents.update((userEvents) => {
		const savedUserEvent = userEvents.get(userEvent.pubkey);

		if (savedUserEvent === undefined || savedUserEvent.created_at < userEvent.created_at) {
			userEvents.set(userEvent.pubkey, userEvent);
		}

		return userEvents;
	});
}
