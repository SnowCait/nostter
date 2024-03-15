import { EventItem } from '$lib/Items';
import { writable } from 'svelte/store';

export const items = writable<EventItem[]>([]);
