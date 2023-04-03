import { writable, type Writable } from 'svelte/store';
import type { Event } from '../routes/types';

export const openNoteDialog = writable(false);
export const replyTo: Writable<Event | undefined> = writable(undefined);
export const quotes: Writable<Event[]> = writable([]);
export const intentContent = writable('');
