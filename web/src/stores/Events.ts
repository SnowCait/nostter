import { writable, type Writable } from 'svelte/store';
import type { Event } from '../routes/types';

export const events: Writable<Event[]> = writable([]);
