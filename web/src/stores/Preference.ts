import { browser } from '$app/environment';
import { writable, type Writable } from 'svelte/store';

// Persistent in relay
export const reactionEmoji = writable('+');

// Persistent in local
export const autoRefresh: Writable<boolean> = writable(true);
if (browser) {
	const autoRefreshString = localStorage.getItem('nostter:preference:auto-refresh');
	if (autoRefreshString !== null) {
		try {
			autoRefresh.set(JSON.parse(autoRefreshString));
		} catch (error) {
			console.error('[failed to parse auto-refresh]', autoRefreshString);
		}
	}
	autoRefresh.subscribe((value) => {
		console.log('[save auto-refresh]', value);
		localStorage.setItem('nostter:preference:auto-refresh', JSON.stringify(value));
	});
}

// Temporary
export const debugMode = writable(false);
