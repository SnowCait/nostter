import { get, writable } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import {
	accountLocalPreferencesKey,
	initializeMediaUploaderPreference,
	mediaUploaderPreferenceValue,
	setMediaUploaderPreference,
	type AccountLocalPreferences
} from './AccountLocalPreferences';

describe('account-local media uploader preferences', () => {
	it('initializes from the existing NIP-78 uploader', () => {
		const store = writable<AccountLocalPreferences>({});
		initializeMediaUploaderPreference(store, 'https://nostr.build');
		expect(get(store).mediaUploader).toEqual({
			type: 'nip96',
			server: 'https://nostr.build'
		});
	});

	it('initializes Blossom only after initialization is requested without a legacy uploader', () => {
		const store = writable<AccountLocalPreferences>({});
		expect(get(store).mediaUploader).toBeUndefined();
		initializeMediaUploaderPreference(store, undefined);
		expect(get(store).mediaUploader).toEqual({ type: 'blossom' });
	});

	it('does not overwrite an existing local uploader', () => {
		const store = writable<AccountLocalPreferences>({ mediaUploader: { type: 'blossom' } });
		initializeMediaUploaderPreference(store, 'https://nostr.build');
		expect(get(store).mediaUploader).toEqual({ type: 'blossom' });
	});

	it('preserves other account preferences when changing uploader', () => {
		const store = writable<AccountLocalPreferences>({
			futurePreference: true
		} as AccountLocalPreferences);
		setMediaUploaderPreference(store, { type: 'blossom' });
		expect(get(store)).toEqual({ futurePreference: true, mediaUploader: { type: 'blossom' } });
	});

	it('uses distinct persisted keys for each account', () => {
		expect(accountLocalPreferencesKey('alice')).toBe('preferences:alice');
		expect(accountLocalPreferencesKey('bob')).toBe('preferences:bob');
		expect(accountLocalPreferencesKey('alice')).not.toBe(accountLocalPreferencesKey('bob'));
	});

	it('keeps Blossom and an existing uploader distinct at the same hostname', () => {
		expect(mediaUploaderPreferenceValue({ type: 'blossom' })).toBe('blossom');
		expect(
			mediaUploaderPreferenceValue({ type: 'nip96', server: 'https://blossom.band' })
		).toBe('nip96:https://blossom.band');
	});
});
