import { get } from 'svelte/store';
import { readRelays, writeRelays, authorProfile, metadataEvent } from '$lib/stores/Author';
import { applyCustomEmojiListSnapshot } from '$lib/author/CustomEmojis';
import { lastReadAt } from '$lib/author/Notifications';
import { preferencesStore } from '$lib/Preferences';
import { authorChannelsEventStore, storeMetadata } from '$lib/cache/Events';
import { bookmarkEvent, legacyBookmarkEvent } from '$lib/author/Bookmark.svelte';
import { profileBadgesEvent } from '$lib/author/ProfileBadges';
import {
	getAccountLocalPreferences,
	initializeMediaUploaderPreference
} from '$lib/preferences/AccountLocalPreferences';
import { updateBlossomServerList } from '$lib/author/BlossomServerList.svelte';
import type { PreparedAccountState } from './prepare-account-state';

export function applyAccountState(pubkey: string, state: PreparedAccountState): void {
	metadataEvent.set(state.metadataEvent);
	if (state.metadataEvent !== undefined) storeMetadata(state.metadataEvent);
	if (state.invalidMetadata !== undefined) {
		console.warn(
			'[invalid metadata]',
			state.invalidMetadata.error,
			state.invalidMetadata.event
		);
	}
	authorProfile.set(state.authorProfile);
	console.log('[profile]', get(authorProfile));

	readRelays.set(state.readRelays);
	writeRelays.set(state.writeRelays);

	applyCustomEmojiListSnapshot(state.customEmojiListEvent);

	bookmarkEvent.set(state.bookmarkEvent);
	legacyBookmarkEvent.set(state.legacyBookmarkEvent);
	profileBadgesEvent.set(state.profileBadgesEvent);

	if (state.legacyReactionEmojiEvent !== undefined) {
		console.log('[preferences from regacy event]', state.legacyReactionEmojiEvent);
	}
	preferencesStore.set(state.preferences);
	initializeMediaUploaderPreference(
		getAccountLocalPreferences(pubkey),
		state.legacyMediaUploader
	);
	updateBlossomServerList(pubkey, state.blossomServerListEvent);

	lastReadAt.set(state.lastReadAt);
	console.debug('[last read at]', new Date(get(lastReadAt) * 1000));
}

export function applyAccountChannels(state: PreparedAccountState): void {
	authorChannelsEventStore.set(state.channelsEvent);
	console.log('[relays]', get(readRelays), get(writeRelays));
}
