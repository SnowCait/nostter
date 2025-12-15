import { browser } from '$app/environment';
import { WebStorage } from '$lib/WebStorage';
import { writable, type Writable } from 'svelte/store';
import { imageOptimizerServers } from '$lib/Constants';

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
			console.error('[failed to parse auto-refresh]', autoRefreshString, error);
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

export const enableAutoPlayGif = writable(
	browser ? new WebStorage(localStorage).get('preference:autoplay-gif') !== 'false' : true
);

export const imageOptimization = writable(browser ? getImageOptimization() : '');

function getImageOptimization(): string {
	const value =
		new WebStorage(localStorage).get('preference:image-optimization') ??
		imageOptimizerServers[0];

	if (value === 'true') {
		return imageOptimizerServers[0];
	} else if (['', 'false'].includes(value)) {
		return '';
	} else {
		return value;
	}
}

// Temporary
export const developerMode = writable(
	browser ? new WebStorage(localStorage).get('preference:developer-mode') === 'true' : false
);
