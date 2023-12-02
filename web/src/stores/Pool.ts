import { readable } from 'svelte/store';
import { SimplePool } from 'nostr-tools';

console.log('[pool store]');

export const pool = readable(new SimplePool());
