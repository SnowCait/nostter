import { writable, type Writable } from 'svelte/store';
import type { EventItem } from '$lib/Items';
import type { Event } from '../routes/types';

export const unreadEvents: Writable<EventItem[]> = writable([]);
export const notifiedEvents: Writable<Event[]> = writable([]);
export const lastReadAt: Writable<number> = writable();
export const loadingNotifications = writable(true);
