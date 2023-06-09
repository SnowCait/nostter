import type { Event } from 'nostr-tools';
import { writable, type Writable } from 'svelte/store';

export const customEmojisEvent: Writable<Event | undefined> = writable();
export const customEmojiTags: Writable<string[][]> = writable([]);
