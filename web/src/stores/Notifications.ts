import { writable, type Writable } from 'svelte/store';
import type { EventItem } from '$lib/Items';

export const unreadEvents: Writable<EventItem[]> = writable([]);
export const notifiedEvents: Writable<EventItem[]> = writable([]);
export const lastReadAt: Writable<number> = writable();
export const loadingNotifications = writable(true);
