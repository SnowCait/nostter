import { get, writable, type Writable } from 'svelte/store';
import type { Event } from 'nostr-typedef';
import type { id, pubkey } from '$lib/Types';
import { EventItem, Metadata } from '$lib/Items';
import { ToastNotification } from '$lib/ToastNotification';
import { db, EventCache } from './db';

export const metadataStore = writable(new Map<pubkey, Metadata>());
export const eventItemStore = writable(new Map<id, EventItem>());
export const replaceableEventsStore = writable(new Map<string, Event>());
export const channelMetadataEventsStore = writable(new Map<id, Event>());

// <id | a, [url]>
export const seenOnStore = writable(new Map<string, Set<string>>());

export const authorChannelsEventStore: Writable<Event | undefined> = writable();

// <event.id, event>
export const cachedEvents = new Map<id, Event>();

export function storeMetadata(event: Event): void {
	const $metadataStore = get(metadataStore);
	const cache = $metadataStore.get(event.pubkey);
	if (cache === undefined || cache.event.created_at < event.created_at) {
		const metadata = new Metadata(event);
		console.debug('[store metadata]', event, metadata.content?.name);
		$metadataStore.set(metadata.event.pubkey, metadata);
		metadataStore.set($metadataStore);

		const toast = new ToastNotification();
		toast.dequeue(metadata);
	}
}

export function storeEventItem(event: Event): void {
	console.debug('[store event]', event);
	const $eventItemStore = get(eventItemStore);
	if (!$eventItemStore.has(event.id)) {
		$eventItemStore.set(event.id, new EventItem(event));
		eventItemStore.set($eventItemStore);
	}
}

export const eventCache = new EventCache(db);
