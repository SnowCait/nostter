import { get, writable, type Writable } from 'svelte/store';
import type { User } from '../routes/types';
import type { Event } from 'nostr-tools';
import { defaultRelays } from './DefaultRelays';
import type { Author } from '$lib/Author';
import { filterRelayTags } from '$lib/EventHelper';

const $defaultRelays = get(defaultRelays);
export const loginType: Writable<'NIP-07' | 'nsec' | 'npub'> = writable();
export const pubkey = writable('');
export const author: Writable<Author | undefined> = writable();
export const authorProfile: Writable<User> = writable();
export const metadataEvent: Writable<Event | undefined> = writable();
export const recommendedRelay = writable('');
export const followees: Writable<string[]> = writable([]);
export const mutePubkeys: Writable<string[]> = writable([]);
export const muteEventIds: Writable<string[]> = writable([]);
export const pinNotes: Writable<string[]> = writable([]);
export const readRelays: Writable<string[]> = writable($defaultRelays);
export const writeRelays: Writable<string[]> = writable($defaultRelays);
export const rom = writable(false);
export const bookmarkEvent: Writable<Event | undefined> = writable();

export const isMutePubkey = (pubkey: string) => get(mutePubkeys).includes(pubkey);
export const isMuteEvent = (event: Event) => {
	if (
		isMutePubkey(event.pubkey) ||
		event.tags.some(([tagName, pubkey]) => tagName === 'p' && isMutePubkey(pubkey))
	) {
		return true;
	}

	const ids = get(muteEventIds);
	return (
		ids.includes(event.id) ||
		event.tags.some(([tagName, id]) => tagName === 'e' && ids.includes(id))
	);
};

export const updateRelays = (event: Event) => {
	console.debug('[relays before]', get(readRelays), get(writeRelays));
	const validRelayTags = filterRelayTags(event.tags);
	readRelays.set(
		Array.from(
			new Set(
				validRelayTags
					.filter(([, , permission]) => permission === undefined || permission === 'read')
					.map(([, relay]) => relay)
			)
		)
	);
	writeRelays.set(
		Array.from(
			new Set(
				validRelayTags
					.filter(
						([, , permission]) => permission === undefined || permission === 'write'
					)
					.map(([, relay]) => relay)
			)
		)
	);
	console.debug('[relays after]', get(readRelays), get(writeRelays));
};

export const isBookmarked = (event: Event): boolean => {
	const $bookmarkEvent = get(bookmarkEvent);
	if ($bookmarkEvent === undefined) {
		return false;
	}
	return $bookmarkEvent.tags.some(([tagName, id]) => tagName === 'e' && id === event.id);
};
