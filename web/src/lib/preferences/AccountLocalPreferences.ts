import { persistedStore } from '$lib/persisted-store';
import type { Persisted } from 'svelte-persisted-store';
import type { Writable } from 'svelte/store';

export type MediaUploaderPreference = { type: 'blossom' } | { type: 'nip96'; server: string };

export type AccountLocalPreferences = {
	mediaUploader?: MediaUploaderPreference;
};

const stores = new Map<string, Persisted<AccountLocalPreferences>>();

export const accountLocalPreferencesKey = (pubkey: string) => `preferences:${pubkey}`;

export function getAccountLocalPreferences(pubkey: string): Persisted<AccountLocalPreferences> {
	let store = stores.get(pubkey);
	if (store === undefined) {
		store = persistedStore(accountLocalPreferencesKey(pubkey), {});
		stores.set(pubkey, store);
	}
	return store;
}

export function initializeMediaUploaderPreference(
	store: Writable<AccountLocalPreferences>,
	legacyMediaUploader: string | undefined
): void {
	store.update((preferences) => {
		if (preferences.mediaUploader !== undefined) {
			return preferences;
		}
		return {
			...preferences,
			mediaUploader:
				legacyMediaUploader === undefined
					? { type: 'blossom' }
					: { type: 'nip96', server: legacyMediaUploader }
		};
	});
}

export function setMediaUploaderPreference(
	store: Writable<AccountLocalPreferences>,
	mediaUploader: MediaUploaderPreference
): void {
	store.update((preferences) => ({ ...preferences, mediaUploader }));
}

export function mediaUploaderPreferenceValue(preference: MediaUploaderPreference): string {
	return preference.type === 'blossom' ? 'blossom' : `nip96:${preference.server}`;
}
