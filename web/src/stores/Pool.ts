import { readable } from 'svelte/store';
import { SimplePool } from 'nostr-tools';

export const pool = readable(new SimplePool({ eoseSubTimeout: 1000 }));
