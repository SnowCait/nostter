import { kinds as Kind, type Event } from 'nostr-tools';
import { get } from 'svelte/store';
import {
	readRelays,
	writeRelays,
	updateRelays,
	authorProfile,
	metadataEvent,
	storeMutedPubkeysByKind,
	storeMutedTagsByEvent
} from '$lib/stores/Author';
import { parseLegacyRelayList } from '$lib/nostr/protocol/nip24';
import { customEmojiListEvent, storeCustomEmojis } from '$lib/author/CustomEmojis';
import type { User } from '../../../../routes/types';
import { lastReadAt } from '$lib/author/Notifications';
import { Preferences, preferencesStore } from '$lib/Preferences';
import { authorChannelsEventStore, storeMetadata } from '$lib/cache/Events';
import { legacyBookmarkIdentifier } from '$lib/Constants';
import { bookmarkEvent, legacyBookmarkEvent } from '$lib/author/Bookmark.svelte';
import { legacyProfileBadgesKey, setProfileBadgesEvent } from '$lib/author/ProfileBadges';
import { profileBadgesKind } from '$lib/ProfileBadgesEvent';
import {
	getAccountLocalPreferences,
	initializeMediaUploaderPreference
} from '$lib/preferences/AccountLocalPreferences';
import { updateBlossomServerList } from '$lib/author/BlossomServerList.svelte';
import type { ListContentDecrypter } from '$lib/List';
import type { LoadedAccountEvents } from '$lib/Author';

export async function applyAccountEvents(
	pubkey: string,
	events: LoadedAccountEvents,
	decryptPrivateListContent?: ListContentDecrypter
): Promise<string[][]> {
	const { replaceableEvents, parameterizedReplaceableEvents } = events;
	const metadata = replaceableEvents.get(Kind.Metadata);
	if (metadata !== undefined) {
		metadataEvent.set(metadata);
		storeMetadata(metadata);
		try {
			authorProfile.set(JSON.parse(metadata.content));
		} catch (error) {
			console.warn('[invalid metadata]', error, metadata);
		}
	} else {
		authorProfile.set({} as User);
	}
	console.log('[profile]', get(authorProfile));

	const contactsTags = storeRelays(replaceableEvents);

	customEmojiListEvent.set(replaceableEvents.get(Kind.UserEmojiList));
	const $customEmojiListEvent = get(customEmojiListEvent);
	if ($customEmojiListEvent !== undefined) {
		storeCustomEmojis($customEmojiListEvent);
	}

	bookmarkEvent.set(replaceableEvents.get(Kind.BookmarkList));
	legacyBookmarkEvent.set(
		parameterizedReplaceableEvents.get(`${Kind.Genericlists}:${legacyBookmarkIdentifier}`)
	);
	setProfileBadgesEvent(
		replaceableEvents.get(profileBadgesKind),
		parameterizedReplaceableEvents.get(legacyProfileBadgesKey)
	);

	const preferencesEvent = parameterizedReplaceableEvents.get(`${30078}:nostter-preferences`);
	let legacyMediaUploader: string | undefined;
	if (preferencesEvent !== undefined) {
		const preferences = new Preferences(preferencesEvent.content);
		legacyMediaUploader = preferences.mediaUploader;
		preferencesStore.set(preferences);
	} else {
		const regacyReactionEmojiEvent = parameterizedReplaceableEvents.get(
			`${30078}:nostter-reaction-emoji`
		);
		if (regacyReactionEmojiEvent !== undefined) {
			console.log('[preferences from regacy event]', regacyReactionEmojiEvent);
			const preferences = new Preferences('{}');
			preferences.reactionEmoji = { content: regacyReactionEmojiEvent.content };
			preferencesStore.set(preferences);
		}
	}
	initializeMediaUploaderPreference(getAccountLocalPreferences(pubkey), legacyMediaUploader);
	updateBlossomServerList(pubkey, replaceableEvents.get(Kind.BlossomServerList));

	const lastReadEvent = parameterizedReplaceableEvents.get(`${30078}:nostter-read`);
	const regacyLastReadEvent = parameterizedReplaceableEvents.get(
		`${30000}:notifications/lastOpened`
	);
	if (lastReadEvent !== undefined) {
		lastReadAt.set(lastReadEvent.created_at);
	} else if (regacyLastReadEvent !== undefined) {
		lastReadAt.set(regacyLastReadEvent.created_at);
	}
	console.debug('[last read at]', new Date(get(lastReadAt) * 1000));

	const muteEvent = replaceableEvents.get(10000);
	if (muteEvent !== undefined) {
		await storeMutedTagsByEvent(muteEvent, pubkey, decryptPrivateListContent);
	}

	const mutedByKindEvents = [...parameterizedReplaceableEvents]
		.map(([, event]) => event)
		.filter((event) => Number(event.kind) === 30007);
	await storeMutedPubkeysByKind(mutedByKindEvents, decryptPrivateListContent);

	// Channels
	const channelsEvent = replaceableEvents.get(10005);
	authorChannelsEventStore.set(channelsEvent);

	console.log('[relays]', get(readRelays), get(writeRelays));

	return contactsTags;
}

// TODO: Ensure created_at
function storeRelays(replaceableEvents: Map<number, Event>): string[][] {
	const contactsEvent = replaceableEvents.get(Kind.Contacts);
	if (contactsEvent !== undefined) {
		if (contactsEvent.content === '') {
			console.log('[relays in kind 3] empty');
		} else {
			const validRelays = [...parseLegacyRelayList(contactsEvent.content)];
			readRelays.set(
				Array.from(
					new Set(validRelays.filter(([, { read }]) => read).map(([relay]) => relay))
				)
			);
			writeRelays.set(
				Array.from(
					new Set(validRelays.filter(([, { write }]) => write).map(([relay]) => relay))
				)
			);
			console.log('[relays in kind 3]', get(readRelays), get(writeRelays));
		}
	}

	const relayListEvent = replaceableEvents.get(Kind.RelayList);
	if (relayListEvent !== undefined) {
		updateRelays(relayListEvent);
		console.log('[relays in kind 10002]', get(readRelays), get(writeRelays));
	}

	return contactsEvent?.tags ?? [];
}
