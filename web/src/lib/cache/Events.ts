import { get, writable, type Writable } from 'svelte/store';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import type { id, pubkey } from '$lib/Types';
import { EventItem, Metadata } from '$lib/Items';
import { ToastNotification } from '$lib/ToastNotification';
import { replaceableKinds } from '$lib/Constants';
import { auth } from '$lib/auth.svelte';
import { db, EventCache, FolloweeReplaceableEventCache } from './db';

export const metadataStore = writable(new Map<pubkey, Metadata>());
export const eventItemStore = writable(new Map<id, EventItem>());
export const replaceableEventsStore = writable(new Map<string, Nostr.Event>());
export const channelMetadataEventsStore = writable(new Map<id, Nostr.Event>());

// <id | a, [url]>
export const seenOnStore = writable(new Map<string, Set<string>>());

export const authorChannelsEventStore: Writable<Nostr.Event | undefined> = writable();

// <event.id, event>
export const cachedEvents = new Map<id, Nostr.Event>();

export function storeMetadata(event: Nostr.Event): void {
	const $metadataStore = get(metadataStore);
	const cache = $metadataStore.get(event.pubkey);
	if (cache === undefined || cache.event.created_at < event.created_at) {
		const metadata = new Metadata(event);
		$metadataStore.set(metadata.event.pubkey, metadata);
		metadataStore.set($metadataStore);

		const toast = new ToastNotification();
		toast.dequeue(metadata);
	}

	cacheFolloweeReplaceableEvent(event);
}

export function storeEventItem(event: Nostr.Event): void {
	console.debug('[store event]', event);
	const $eventItemStore = get(eventItemStore);
	if (!$eventItemStore.has(event.id)) {
		$eventItemStore.set(event.id, new EventItem(event));
		eventItemStore.set($eventItemStore);
	}
}

export const eventCache = new EventCache(db);
export const followeeEventCache = new FolloweeReplaceableEventCache(db);

export function cacheFolloweeReplaceableEvent(event: Nostr.Event): void {
	if (!replaceableKinds.includes(event.kind) || !auth.followeesSet.has(event.pubkey)) {
		return;
	}
	followeeEventCache.put(event);
}

export async function loadFolloweesMetadataCache(pubkeys: string[]): Promise<void> {
	const eventsMap = await followeeEventCache.getLatest(Kind.Metadata, pubkeys);
	const $metadataStore = get(metadataStore);
	for (const [pubkey, event] of eventsMap) {
		const cache = $metadataStore.get(pubkey);
		if (cache === undefined || cache.event.created_at < event.created_at) {
			$metadataStore.set(pubkey, new Metadata(event));
		}
	}
	metadataStore.set($metadataStore);
}

export async function pruneFolloweeReplaceableEventsCache(pubkeys: string[]): Promise<void> {
	if (pubkeys.length <= 1) {
		return;
	}
	await followeeEventCache.pruneExcept(pubkeys);
}
