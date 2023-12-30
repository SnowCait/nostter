import { Kind, type Event } from 'nostr-tools';
import { get, writable } from 'svelte/store';
import { followees } from './Author';

console.log('[last notes store]');

export const lastNotesMap = writable(new Map<string, Event>());
export const saveLastNote = (event: Event) => {
	if (event.kind !== Kind.Text || !get(followees).includes(event.pubkey)) {
		return;
	}

	lastNotesMap.update((map) => {
		const lastNote = map.get(event.pubkey);
		if (lastNote === undefined || lastNote.created_at < event.created_at) {
			map.set(event.pubkey, event);
		}
		return map;
	});
};
