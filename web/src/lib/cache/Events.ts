import { get, writable } from 'svelte/store';
import type { Event } from 'nostr-tools';
import type { id, pubkey } from '$lib/Types';
import { EventItem, Metadata } from '$lib/Items';
import { events } from '../../stores/Events';

// <event.id, event>
export const cachedEvents = new Map<id, Event>();
// <event.pubkey, event>
export const metadataEvents = new Map<pubkey, Event>();
export const metadataStore = writable(new Map<pubkey, Metadata>());
// <root-id, event>
export const channelMetadataEvents = new Map<id, Event>();

export function getCachedEventItem(id: string): EventItem | undefined {
	let item = get(events).find((item) => item.event.id === id);
	if (item === undefined) {
		const event = cachedEvents.get(id);
		if (event !== undefined) {
			item = new EventItem(event, metadataEvents.get(event.pubkey));
		}
	}
	return item;
}
