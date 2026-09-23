import { kinds as Kind, type Event } from 'nostr-tools';
import { writable } from 'svelte/store';
import { auth } from '$lib/auth.svelte';

export const lastNotesMap = writable(new Map<string, Event>());
export const saveLastNote = (event: Event) => {
	if (event.kind !== Kind.ShortTextNote || !auth.followeesSet.has(event.pubkey)) {
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
