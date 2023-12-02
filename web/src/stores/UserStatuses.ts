import type { Event } from 'nostr-tools';
import { writable, type Writable } from 'svelte/store';

console.log('[user statuses store]');

export const userStatusesGeneral: Writable<Event[]> = writable([]);
export const userStatusesMusic: Writable<Event[]> = writable([]);
