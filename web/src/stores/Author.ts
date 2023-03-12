import { writable, type Writable } from 'svelte/store';

export const pubkey = writable('');
export const relays: Writable<Set<URL>> = writable(new Set());
export const recommendedRelay = writable('');
