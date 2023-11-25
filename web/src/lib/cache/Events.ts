import { writable, type Writable } from 'svelte/store';
import type { Event } from 'nostr-typedef';
import type { id, pubkey } from '$lib/Types';
import type { EventItem, Metadata } from '$lib/Items';

export const metadataStore = writable(new Map<pubkey, Metadata>());
export const eventItemStore = writable(new Map<id, EventItem>());
export const channelMetadataEventsStore = writable(new Map<id, Event>());

export const authorChannelsEventStore: Writable<Event | undefined> = writable();

// <event.id, event>
export const cachedEvents = new Map<id, Event>();
