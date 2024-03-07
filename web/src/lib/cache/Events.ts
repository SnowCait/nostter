import { get, writable, type Writable } from 'svelte/store';
import type { Event } from 'nostr-typedef';
import type { id, pubkey } from '$lib/Types';
import { Metadata, type EventItem } from '$lib/Items';
import { ToastNotification } from '$lib/ToastNotification';

export const metadataStore = writable(new Map<pubkey, Metadata>());
export const eventItemStore = writable(new Map<id, EventItem>());
export const replaceableEventsStore = writable(new Map<string, Event>());
export const channelMetadataEventsStore = writable(new Map<id, Event>());

export const authorChannelsEventStore: Writable<Event | undefined> = writable();

// <event.id, event>
export const cachedEvents = new Map<id, Event>();

export function storeMetadata(event: Event): void {
	const $metadataStore = get(metadataStore);
	const cache = $metadataStore.get(event.pubkey);
	if (cache === undefined || cache.event.created_at < event.created_at) {
		const metadata = new Metadata(event);
		console.log('[rx-nostr metadata]', event, metadata.content?.name);
		$metadataStore.set(metadata.event.pubkey, metadata);
		metadataStore.set($metadataStore);

		const toast = new ToastNotification();
		toast.dequeue(metadata);
	}
}
