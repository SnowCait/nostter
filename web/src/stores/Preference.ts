import { writable } from 'svelte/store';

// Persistent
export const reactionEmoji = writable('+');

// Temporary
export const debugMode = writable(false);
