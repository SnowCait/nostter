import { writable, type Writable } from 'svelte/store';
import type * as Nostr from 'nostr-typedef';
import type { EventItem } from '$lib/Items';

export const openNoteDialog = writable(false);
export const replyTo: Writable<EventItem | undefined> = writable(undefined);
export const quotes: Writable<Nostr.Event[]> = writable([]);
export const intentContent = writable('');
