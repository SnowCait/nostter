import { get } from 'svelte/store';
import { repostedEvents } from './Action';
import { sortEvents, type Event } from 'nostr-tools';
import { requestEventDeletion } from './Delete';

export async function undoRepost(target: Event): Promise<void> {
	const $repostedEvents = get(repostedEvents);
	const events = $repostedEvents.get(target.id);
	if (events === undefined || events.length === 0) {
		return;
	}

	const sortedEvents = sortEvents(events);
	await requestEventDeletion(sortedEvents.slice(0, 1));
	$repostedEvents.set(target.id, sortedEvents.slice(1));
	repostedEvents.set($repostedEvents);
}
