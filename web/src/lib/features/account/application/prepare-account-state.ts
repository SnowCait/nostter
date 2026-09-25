import { kinds as Kind, type Event } from 'nostr-tools';
import type { User } from '../../../../routes/types';
import { defaultRelays, legacyBookmarkIdentifier } from '$lib/Constants';
import { Preferences } from '$lib/Preferences';
import { parseLegacyRelayList } from '$lib/nostr/protocol/nip24';
import { getReadRelays, getWriteRelays, parseRelayList } from '$lib/nostr/protocol/nip65';
import {
	legacyProfileBadgesIdentifier,
	legacyProfileBadgesKind,
	profileBadgesKind,
	isProfileBadgesEvent,
	selectProfileBadgesEvent
} from '$lib/ProfileBadgesEvent';
import type { LoadedAccountEvents } from '$lib/Author';
import { parseFollowingHashtags } from '$lib/nostr/protocol/interest-list';

export type PreparedAccountState = {
	contactsTags: string[][];
	followingHashtags: string[];
	metadataEvent: Event | undefined;
	authorProfile: User;
	invalidMetadata: { event: Event; error: unknown } | undefined;
	readRelays: string[];
	writeRelays: string[];
	customEmojiListEvent: Event | undefined;
	bookmarkEvent: Event | undefined;
	legacyBookmarkEvent: Event | undefined;
	profileBadgesEvent: Event | undefined;
	preferences: Preferences;
	legacyReactionEmojiEvent: Event | undefined;
	legacyMediaUploader: string | undefined;
	blossomServerListEvent: Event | undefined;
	lastReadAt: number;
	channelsEvent: Event | undefined;
};

export function prepareAccountState(events: LoadedAccountEvents): PreparedAccountState {
	const { replaceableEvents, parameterizedReplaceableEvents } = events;

	const metadataEvent = replaceableEvents.get(Kind.Metadata);
	let authorProfile: User;
	let invalidMetadata: PreparedAccountState['invalidMetadata'] = undefined;
	if (metadataEvent === undefined) {
		authorProfile = {} as User;
	} else {
		try {
			authorProfile = JSON.parse(metadataEvent.content) as User;
		} catch (error) {
			authorProfile = {} as User;
			invalidMetadata = { event: metadataEvent, error };
		}
	}

	const contactsEvent = replaceableEvents.get(Kind.Contacts);
	let readRelays = defaultRelays.filter(({ read }) => read).map(({ url }) => url);
	let writeRelays = defaultRelays.filter(({ write }) => write).map(({ url }) => url);
	if (contactsEvent !== undefined && contactsEvent.content !== '') {
		const validRelays = [...parseLegacyRelayList(contactsEvent.content)];
		readRelays = [
			...new Set(validRelays.filter(([, { read }]) => read).map(([relay]) => relay))
		];
		writeRelays = [
			...new Set(validRelays.filter(([, { write }]) => write).map(([relay]) => relay))
		];
	}

	const relayListEvent = replaceableEvents.get(Kind.RelayList);
	if (relayListEvent !== undefined) {
		const entries = parseRelayList(relayListEvent.tags);
		readRelays = [...new Set(getReadRelays(entries))];
		writeRelays = [...new Set(getWriteRelays(entries))];
	}

	const legacyReactionEmojiCandidate = parameterizedReplaceableEvents.get(
		`${30078}:nostter-reaction-emoji`
	);
	let legacyReactionEmojiEvent: Event | undefined;
	const preferencesEvent = parameterizedReplaceableEvents.get(`${30078}:nostter-preferences`);
	let preferences = new Preferences('{}');
	let legacyMediaUploader: string | undefined;
	if (preferencesEvent !== undefined) {
		const value = new Preferences(preferencesEvent.content);
		legacyMediaUploader = value.mediaUploader;
		preferences = value;
	} else if (legacyReactionEmojiCandidate !== undefined) {
		legacyReactionEmojiEvent = legacyReactionEmojiCandidate;
		const value = new Preferences('{}');
		value.reactionEmoji = { content: legacyReactionEmojiEvent.content };
		preferences = value;
	}

	const lastReadEvent = parameterizedReplaceableEvents.get(`${30078}:nostter-read`);
	const legacyLastReadEvent = parameterizedReplaceableEvents.get(
		`${30000}:notifications/lastOpened`
	);
	const lastReadAt =
		lastReadEvent !== undefined
			? lastReadEvent.created_at
			: legacyLastReadEvent !== undefined
				? legacyLastReadEvent.created_at
				: 0;

	const currentProfileBadges = replaceableEvents.get(profileBadgesKind);
	const legacyProfileBadges = parameterizedReplaceableEvents.get(
		`${legacyProfileBadgesKind}:${legacyProfileBadgesIdentifier}`
	);

	return {
		contactsTags: contactsEvent?.tags ?? [],
		followingHashtags: parseFollowingHashtags(replaceableEvents.get(Kind.InterestsList)),
		metadataEvent,
		authorProfile,
		invalidMetadata,
		readRelays,
		writeRelays,
		customEmojiListEvent: replaceableEvents.get(Kind.UserEmojiList),
		bookmarkEvent: replaceableEvents.get(Kind.BookmarkList),
		legacyBookmarkEvent: parameterizedReplaceableEvents.get(
			`${Kind.Genericlists}:${legacyBookmarkIdentifier}`
		),
		profileBadgesEvent: selectProfileBadgesEvent(
			currentProfileBadges !== undefined && isProfileBadgesEvent(currentProfileBadges)
				? currentProfileBadges
				: undefined,
			legacyProfileBadges !== undefined && isProfileBadgesEvent(legacyProfileBadges)
				? legacyProfileBadges
				: undefined
		),
		preferences,
		legacyReactionEmojiEvent,
		legacyMediaUploader,
		blossomServerListEvent: replaceableEvents.get(Kind.BlossomServerList),
		lastReadAt,
		channelsEvent: replaceableEvents.get(10005)
	};
}
