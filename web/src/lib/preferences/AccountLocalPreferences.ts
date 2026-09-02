import { persistedStore } from '$lib/persisted-store';
import { defaultBlossomServerUrl } from '$lib/Constants';
import type { Persisted } from 'svelte-persisted-store';
import type { Writable } from 'svelte/store';

export type MediaUploaderPreference =
	{ type: 'blossom'; server: string } | { type: 'nip96'; server: string };

export type AccountLocalPreferences = {
	mediaUploader?: MediaUploaderPreference;
};

const stores = new Map<string, Persisted<AccountLocalPreferences>>();

const accountLocalPreferencesKey = (pubkey: string) => `preferences:${pubkey}`;

export function getAccountLocalPreferences(pubkey: string): Persisted<AccountLocalPreferences> {
	let store = stores.get(pubkey);
	if (store === undefined) {
		store = persistedStore(accountLocalPreferencesKey(pubkey), {});
		store.update(normalizeAccountLocalPreferences);
		stores.set(pubkey, store);
	}
	return store;
}

function normalizeAccountLocalPreferences(
	preferences: AccountLocalPreferences
): AccountLocalPreferences {
	const mediaUploader = preferences.mediaUploader as
		MediaUploaderPreference | { type: 'blossom'; server?: string } | undefined;
	if (mediaUploader?.type !== 'blossom' || typeof mediaUploader.server === 'string') {
		return preferences;
	}
	return {
		...preferences,
		mediaUploader: { type: 'blossom', server: defaultBlossomServerUrl }
	};
}

export function initializeMediaUploaderPreference(
	store: Writable<AccountLocalPreferences>,
	legacyMediaUploader: string | undefined
): void {
	store.update((preferences) => {
		if (preferences.mediaUploader !== undefined) {
			return normalizeAccountLocalPreferences(preferences);
		}
		return {
			...preferences,
			mediaUploader:
				legacyMediaUploader === undefined
					? { type: 'blossom', server: defaultBlossomServerUrl }
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
