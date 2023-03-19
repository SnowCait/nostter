import { writable, type Writable } from 'svelte/store';
import type { User } from '../routes/types';

export const pubkey = writable('');
export const authorProfile: Writable<User> = writable();
export const recommendedRelay = writable('');
export const followees: Writable<string[]> = writable([]);
export const relayUrls: Writable<string[]> = writable([]);
export const rom = writable(false);
