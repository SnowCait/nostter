import { writable } from 'svelte/store';
import type { EventItem } from '$lib/Items';

export const pubkey = writable('');
export const since = writable(0);
export const items = writable<EventItem[]>([]);
