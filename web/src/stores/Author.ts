import { get, writable, type Writable } from 'svelte/store';
import type { User } from '../routes/types';
import type { Event } from 'nostr-tools';

export const pubkey = writable('');
export const authorProfile: Writable<User> = writable();
export const recommendedRelay = writable('');
export const followees: Writable<string[]> = writable([]);
export const mutePubkeys: Writable<string[]> = writable([]);
export const muteEventIds: Writable<string[]> = writable([]);
export const pinNotes: Writable<string[]> = writable([]);
export const relayUrls: Writable<string[]> = writable([]);
export const rom = writable(false);

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
