import { writable, type Writable } from 'svelte/store';
import type { EventItem } from '$lib/Items';

console.log('[notifications store]');

export const unreadEventItems: Writable<EventItem[]> = writable([]);
export const notifiedEventItems: Writable<EventItem[]> = writable([]);
export const lastReadAt: Writable<number> = writable();
export const lastNotifiedAt = writable(0);
