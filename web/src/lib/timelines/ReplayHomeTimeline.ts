import { writable } from 'svelte/store';
import type { Subscription } from 'rxjs';
import type { EventItem } from '$lib/Items';
import type { Timeout } from '$lib/Types';

export const fetchInterval = 5 * 60;
export const speeds = [1, 1.25, 1.5, 2, 3, 5, 10];

export const items = writable<EventItem[]>([]);
export const itemsPool = writable<EventItem[]>([]);

export const sinceDate = writable<Date | undefined>();
export const speed = writable<number>(speeds[0]);

export const startedAt = writable<number | undefined>(); // ms
export const firstSince = writable<number | undefined>(); // s

// Clear
export const subscription = writable<Subscription | undefined>();
export const eventTimeouts = writable<Timeout[]>([]);
export const fetchTimeout = writable<Timeout | undefined>();
