import { get } from 'svelte/store';
import { repostedEvents } from './Action';
import { sortEvents, type Event } from 'nostr-tools';
import { requestEventDeletion } from '../features/event-deletion/application/request-event-deletion';

export function undoRepost(target: Event): void {
	const $repostedEvents = get(repostedEvents);
	const events = $repostedEvents.get(target.id);
	if (events === undefined || events.length === 0) {
		return;
	}

	const sortedEvents = sortEvents(events);
	void requestEventDeletion(sortedEvents.slice(0, 1)).catch(() => {});
	$repostedEvents.set(target.id, sortedEvents.slice(1));
	repostedEvents.set($repostedEvents);
}
