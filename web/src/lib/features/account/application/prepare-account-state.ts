import { kinds as Kind, type Event } from 'nostr-tools';
import type { User } from '../../../../routes/types';
import { legacyBookmarkIdentifier } from '$lib/Constants';
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

type Publication<T> = { type: 'publish'; value: T } | { type: 'unchanged' };

type PreparedRelayUpdate = {
	readRelays: string[];
	writeRelays: string[];
	source: 'contacts' | 'relay-list';
};

export type PreparedAccountState = {
	contactsTags: string[][];
	metadataEvent: Publication<Event>;
	authorProfile: Publication<User>;
	invalidMetadata: { event: Event; error: unknown } | undefined;
	relayUpdates: PreparedRelayUpdate[];
	emptyContactsRelayList: boolean;
	customEmojiListEvent: Event | undefined;
	bookmarkEvent: Event | undefined;
	legacyBookmarkEvent: Event | undefined;
	profileBadgesEvent: Event | undefined;
	preferences: Publication<Preferences>;
	legacyReactionEmojiEvent: Event | undefined;
	legacyMediaUploader: string | undefined;
	blossomServerListEvent: Event | undefined;
	lastReadAt: Publication<number>;
	channelsEvent: Event | undefined;
};

export function prepareAccountState(events: LoadedAccountEvents): PreparedAccountState {
	const { replaceableEvents, parameterizedReplaceableEvents } = events;

	const metadataEvent = replaceableEvents.get(Kind.Metadata);
	let authorProfile: Publication<User>;
	let invalidMetadata: PreparedAccountState['invalidMetadata'] = undefined;
	if (metadataEvent === undefined) {
		authorProfile = { type: 'publish', value: {} as User };
	} else {
		try {
			authorProfile = { type: 'publish', value: JSON.parse(metadataEvent.content) };
		} catch (error) {
			authorProfile = { type: 'unchanged' };
			invalidMetadata = { event: metadataEvent, error };
		}
	}

	const contactsEvent = replaceableEvents.get(Kind.Contacts);
	const relayUpdates: PreparedRelayUpdate[] = [];
	let emptyContactsRelayList = false;
	if (contactsEvent !== undefined) {
		if (contactsEvent.content === '') {
			emptyContactsRelayList = true;
		} else {
			const validRelays = [...parseLegacyRelayList(contactsEvent.content)];
			relayUpdates.push({
				source: 'contacts',
				readRelays: [
					...new Set(validRelays.filter(([, { read }]) => read).map(([relay]) => relay))
				],
				writeRelays: [
					...new Set(validRelays.filter(([, { write }]) => write).map(([relay]) => relay))
				]
			});
		}
	}

	const relayListEvent = replaceableEvents.get(Kind.RelayList);
	if (relayListEvent !== undefined) {
		const entries = parseRelayList(relayListEvent.tags);
		relayUpdates.push({
			source: 'relay-list',
			readRelays: [...new Set(getReadRelays(entries))],
			writeRelays: [...new Set(getWriteRelays(entries))]
		});
	}

	const legacyReactionEmojiCandidate = parameterizedReplaceableEvents.get(
		`${30078}:nostter-reaction-emoji`
	);
	let legacyReactionEmojiEvent: Event | undefined;
	const preferencesEvent = parameterizedReplaceableEvents.get(`${30078}:nostter-preferences`);
	let preferences: Publication<Preferences> = { type: 'unchanged' };
	let legacyMediaUploader: string | undefined;
	if (preferencesEvent !== undefined) {
		const value = new Preferences(preferencesEvent.content);
		legacyMediaUploader = value.mediaUploader;
		preferences = { type: 'publish', value };
	} else if (legacyReactionEmojiCandidate !== undefined) {
		legacyReactionEmojiEvent = legacyReactionEmojiCandidate;
		const value = new Preferences('{}');
		value.reactionEmoji = { content: legacyReactionEmojiEvent.content };
		preferences = { type: 'publish', value };
	}

	const lastReadEvent = parameterizedReplaceableEvents.get(`${30078}:nostter-read`);
	const legacyLastReadEvent = parameterizedReplaceableEvents.get(
		`${30000}:notifications/lastOpened`
	);
	const lastReadAt: Publication<number> =
		lastReadEvent !== undefined
			? { type: 'publish', value: lastReadEvent.created_at }
			: legacyLastReadEvent !== undefined
				? { type: 'publish', value: legacyLastReadEvent.created_at }
				: { type: 'unchanged' };

	const currentProfileBadges = replaceableEvents.get(profileBadgesKind);
	const legacyProfileBadges = parameterizedReplaceableEvents.get(
		`${legacyProfileBadgesKind}:${legacyProfileBadgesIdentifier}`
	);

	return {
		contactsTags: contactsEvent?.tags ?? [],
		metadataEvent:
			metadataEvent === undefined
				? { type: 'unchanged' }
				: { type: 'publish', value: metadataEvent },
		authorProfile,
		invalidMetadata,
		relayUpdates,
		emptyContactsRelayList,
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
