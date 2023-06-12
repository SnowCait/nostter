import { Kind, type Event } from 'nostr-tools';
import { writable } from 'svelte/store';

export const lastNotesMap = writable(new Map<string, Event>());
export const saveLastNote = (event: Event) => {
	if (event.kind !== Kind.Text) {
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
