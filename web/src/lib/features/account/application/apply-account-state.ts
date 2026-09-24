import { get } from 'svelte/store';
import { readRelays, writeRelays, authorProfile, metadataEvent } from '$lib/stores/Author';
import { customEmojiListEvent, storeCustomEmojis } from '$lib/author/CustomEmojis';
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
	if (state.metadataEvent.type === 'publish') {
		metadataEvent.set(state.metadataEvent.value);
		storeMetadata(state.metadataEvent.value);
	}
	if (state.invalidMetadata !== undefined) {
		console.warn(
			'[invalid metadata]',
			state.invalidMetadata.error,
			state.invalidMetadata.event
		);
	}
	if (state.authorProfile.type === 'publish') {
		authorProfile.set(state.authorProfile.value);
	}
	console.log('[profile]', get(authorProfile));

	if (state.emptyContactsRelayList) {
		console.log('[relays in kind 3] empty');
	}
	for (const relayUpdate of state.relayUpdates) {
		if (relayUpdate.source === 'contacts') {
			readRelays.set(relayUpdate.readRelays);
			writeRelays.set(relayUpdate.writeRelays);
			console.log('[relays in kind 3]', get(readRelays), get(writeRelays));
		} else {
			console.debug('[relays before]', get(readRelays), get(writeRelays));
			readRelays.set(relayUpdate.readRelays);
			writeRelays.set(relayUpdate.writeRelays);
			console.debug('[relays after]', get(readRelays), get(writeRelays));
			console.log('[relays in kind 10002]', get(readRelays), get(writeRelays));
		}
	}

	customEmojiListEvent.set(state.customEmojiListEvent);
	const $customEmojiListEvent = get(customEmojiListEvent);
	if ($customEmojiListEvent !== undefined) {
		storeCustomEmojis($customEmojiListEvent);
	}

	bookmarkEvent.set(state.bookmarkEvent);
	legacyBookmarkEvent.set(state.legacyBookmarkEvent);
	profileBadgesEvent.set(state.profileBadgesEvent);

	if (state.preferences.type === 'publish') {
		if (state.legacyReactionEmojiEvent !== undefined) {
			console.log('[preferences from regacy event]', state.legacyReactionEmojiEvent);
		}
		preferencesStore.set(state.preferences.value);
	}
	initializeMediaUploaderPreference(
		getAccountLocalPreferences(pubkey),
		state.legacyMediaUploader
	);
	updateBlossomServerList(pubkey, state.blossomServerListEvent);

	if (state.lastReadAt.type === 'publish') {
		lastReadAt.set(state.lastReadAt.value);
	}
	console.debug('[last read at]', new Date(get(lastReadAt) * 1000));
}

export function applyAccountChannels(state: PreparedAccountState): void {
	authorChannelsEventStore.set(state.channelsEvent);
	console.log('[relays]', get(readRelays), get(writeRelays));
}
