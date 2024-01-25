import type { Event } from 'nostr-typedef';
import { get, writable, type Writable } from 'svelte/store';

export const bookmarkEvent: Writable<Event | undefined> = writable();

export const isBookmarked = (event: Event): boolean => {
	const $bookmarkEvent = get(bookmarkEvent);
	if ($bookmarkEvent === undefined) {
		return false;
	}
	return $bookmarkEvent.tags.some(([tagName, id]) => tagName === 'e' && id === event.id);
};
