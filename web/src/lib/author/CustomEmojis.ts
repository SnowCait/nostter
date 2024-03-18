import type { Event } from 'nostr-tools';
import { writable, type Writable } from 'svelte/store';

console.log('[custome emojis store]');

// kind 10030
export const customEmojisEvent: Writable<Event | undefined> = writable();
// kind 10030 + 30030
export const customEmojiTags: Writable<string[][]> = writable([]);
