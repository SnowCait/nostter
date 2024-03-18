import type { Event } from 'nostr-typedef';
import { writable } from 'svelte/store';

// kind 10030
export const customEmojisEvent = writable<Event | undefined>();
// kind 10030 + 30030
export const customEmojiTags = writable<string[][]>([]);
