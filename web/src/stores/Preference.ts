import { writable } from 'svelte/store';

// Persistent in relay
export const reactionEmoji = writable('+');

// Persistent in local
export const autoRefresh = writable(true);

// Temporary
export const debugMode = writable(false);
