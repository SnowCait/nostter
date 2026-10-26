import { get, writable } from 'svelte/store';
import { eventItemStore, storeEventItem } from './cache/Events';
import { fetchEventById } from './nostr/relay/event-operations';
import { EventItem } from './Items';
import { events } from './stores/Events';
import { authorActionReqEmit } from './author/Action';
import { referencesReqEmit } from './timelines/MainTimeline';

export const inThread = writable(false);

export async function fetchEvent(id: string): Promise<EventItem | undefined> {
	const $eventItemStore = get(eventItemStore);
	if ($eventItemStore.has(id)) {
		return $eventItemStore.get(id);
	}

	const $events = get(events);
	const item = $events.find((item) => item.id === id);
	if (item) {
		return item;
	}

	const event = await fetchEventById(id);
	if (event !== undefined) {
		referencesReqEmit(event);
		authorActionReqEmit(event);
		storeEventItem(event);
		return $eventItemStore.get(id);
	} else {
		return undefined;
	}
}
