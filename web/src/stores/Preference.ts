import { browser } from '$app/environment';
import type { Emoji } from '$lib/Emoji';
import { WebStorage } from '$lib/WebStorage';
import { writable, type Writable } from 'svelte/store';

// Persistent in relay
export const reactionEmoji: Writable<Emoji> = writable({ content: '+' });

// Persistent in local
export const autoRefresh: Writable<boolean> = writable(true);
if (browser) {
	const storage = new WebStorage(localStorage);
	const autoRefreshString = storage.get('preference:auto-refresh');
	if (autoRefreshString !== null) {
		try {
			autoRefresh.set(JSON.parse(autoRefreshString));
		} catch (error) {
			console.error('[failed to parse auto-refresh]', autoRefreshString);
		}
	}
	autoRefresh.subscribe((value) => {
		console.log('[save auto-refresh]', value);
		storage.set('preference:auto-refresh', JSON.stringify(value));
	});
}

// Temporary
export const debugMode = writable(false);
