import { writable } from 'svelte/store';
import type { Event } from 'nostr-tools';
import type { id, pubkey } from '$lib/Types';
import type { EventItem, Metadata } from '$lib/Items';

export const metadataStore = writable(new Map<pubkey, Metadata>());
export const eventItemStore = writable(new Map<id, EventItem>());

// <event.id, event>
export const cachedEvents = new Map<id, Event>();
// <root-id, event>
export const channelMetadataEvents = new Map<id, Event>();
