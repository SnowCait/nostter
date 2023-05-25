import { writable, type Writable } from 'svelte/store';
import type { Event } from '../routes/types';
import type { Event as NostrEvent } from 'nostr-tools';

export const events: Writable<Event[]> = writable([]);
export const searchEvents: Writable<Event[]> = writable([]);
export const cachedEvents: Writable<Map<string, Event>> = writable(new Map());
export const cachedReplaceableEvents: Writable<Map<string, NostrEvent>> = writable(new Map());
