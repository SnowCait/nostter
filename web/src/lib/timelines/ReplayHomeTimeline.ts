import { writable } from 'svelte/store';
import type { Subscription } from 'rxjs';
import type { EventItem } from '$lib/Items';
import type { Timeout } from '$lib/Types';

export const fetchInterval = 5 * 60;

export const items = writable<EventItem[]>([]);
export const itemsPool = writable<EventItem[]>([]);

export const sinceDate = writable<Date | undefined>();

export const startedAt = writable<number | undefined>(); // ms
export const firstSince = writable<number | undefined>(); // s

// Clear
export const subscription = writable<Subscription | undefined>();
export const eventTimeouts = writable<Timeout[]>([]);
export const fetchTimeout = writable<Timeout | undefined>();
