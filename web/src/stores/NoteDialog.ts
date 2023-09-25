import { writable, type Writable } from 'svelte/store';
import type { Event } from '../routes/types';
import type { EventItem } from '$lib/Items';

export const openNoteDialog = writable(false);
export const replyTo: Writable<EventItem | undefined> = writable(undefined);
export const quotes: Writable<Event[]> = writable([]);
export const intentContent = writable('');
