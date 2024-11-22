import { EventItem } from '$lib/Items';
import type { Event as NostrEvent } from 'nostr-typedef';

export function insertIntoAscendingTimeline(event: NostrEvent, items: EventItem[]) {
	const item = new EventItem(event);
	const index = items.findIndex((x) => x.event.created_at > item.event.created_at);
	if (index < 0) {
		items.push(item);
	} else {
		items.splice(index, 0, item);
	}
}
