import { Kind, type Event } from 'nostr-tools';
import { writable } from 'svelte/store';

console.log('[last notes store]');

export const lastNotesMap = writable(new Map<string, Event>());
export const saveLastNotes = (events: Event[]) => {
	lastNotesMap.update((map) => {
		for (const event of events.filter((x) => x.kind === Kind.Text)) {
			const lastNote = map.get(event.pubkey);
			if (lastNote === undefined || lastNote.created_at < event.created_at) {
				map.set(event.pubkey, event);
			}
		}
		return map;
	});
};
