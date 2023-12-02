import { browser } from '$app/environment';
import { WebStorage } from '$lib/WebStorage';
import { writable, type Writable } from 'svelte/store';

console.log('[preference store]');

// Persistent in relay => $lib/Preferences.ts

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
export const enablePreview = writable(
	browser ? new WebStorage(localStorage).get('preference:preview') !== 'false' : true
);

// Temporary
export const debugMode = writable(false);
