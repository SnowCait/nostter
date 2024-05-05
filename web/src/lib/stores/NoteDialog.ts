import { writable, type Writable } from 'svelte/store';
import type { Event } from 'nostr-typedef';
import type { EventItem } from '$lib/Items';

console.log('[note dialog store]');

export const openNoteDialog = writable(false);
export const replyTo: Writable<EventItem | undefined> = writable(undefined);
export const quotes: Writable<Event[]> = writable([]);
export const intentContent = writable('');
