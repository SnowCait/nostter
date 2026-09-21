import { kinds as Kind, type Event } from 'nostr-tools';
import { get } from 'svelte/store';
import { createRxBackwardReq, latestEach, uniq } from 'rx-nostr';
import {
	readRelays,
	writeRelays,
	updateRelays,
	authorProfile,
	metadataEvent,
	isMuteEvent,
	storeMutedPubkeysByKind,
	storeMutedTagsByEvent
} from './stores/Author';
import { RelayList } from './author/RelayList';
import { findIdentifier } from './nostr/protocol/event-address';
import { parseLegacyRelayList } from './nostr/protocol/nip24';
import { customEmojiListEvent, storeCustomEmojis } from './author/CustomEmojis';
import type { User } from '../routes/types';
import { lastReadAt } from './author/Notifications';
import { WebStorage } from './WebStorage';
import { Preferences, preferencesStore } from './Preferences';
import { rxNostr, tie } from './timelines/MainTimeline';
import { authorChannelsEventStore, storeMetadata } from './cache/Events';
import {
	authorReplaceableKinds,
	legacyBookmarkIdentifier,
	parameterizedReplaceableKinds,
	replaceableKinds
} from './Constants';
import { bookmarkEvent, legacyBookmarkEvent } from './author/Bookmark.svelte';
import { legacyProfileBadgesKey, setProfileBadgesEvent } from './author/ProfileBadges';
import { profileBadgesKind } from './ProfileBadgesEvent';
import {
	getAccountLocalPreferences,
	initializeMediaUploaderPreference
} from './preferences/AccountLocalPreferences';
import { updateBlossomServerList } from './author/BlossomServerList.svelte';

export class Author {
	constructor(private pubkey: string) {}

	public isRelated(event: Event): boolean {
		return event.tags.some(
			([tagName, tagContent]) => tagName === 'p' && tagContent === this.pubkey
		);
	}

	public isNotified(event: Event): boolean {
		return event.pubkey !== this.pubkey && this.isRelated(event) && !isMuteEvent(event);
	}

	public async fetchRelays() {
		const relayEvents = await RelayList.fetchEvents(this.pubkey);
		console.log('[relay events]', relayEvents);

		RelayList.apply(relayEvents);
	}

	// TODO: Ensure created_at
	public storeRelays(replaceableEvents: Map<number, Event>): string[][] {
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
						new Set(
							validRelays.filter(([, { write }]) => write).map(([relay]) => relay)
						)
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

	public async fetchEvents(): Promise<string[][]> {
		const { replaceableEvents, parameterizedReplaceableEvents } =
			await this.fetchAuthorEventsWithCache(this.pubkey);

		const $metadataEvent = replaceableEvents.get(Kind.Metadata);
		if ($metadataEvent !== undefined) {
			metadataEvent.set($metadataEvent);
			storeMetadata($metadataEvent);
			try {
				authorProfile.set(JSON.parse($metadataEvent.content));
			} catch (error) {
				console.warn('[invalid metadata]', error, $metadataEvent);
			}
		} else {
			authorProfile.set({} as User);
		}
		console.log('[profile]', get(authorProfile));

		const contactsTags = this.storeRelays(replaceableEvents);

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
		initializeMediaUploaderPreference(
			getAccountLocalPreferences(this.pubkey),
			legacyMediaUploader
		);
		updateBlossomServerList(this.pubkey, replaceableEvents.get(Kind.BlossomServerList));

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
			await storeMutedTagsByEvent(muteEvent, this.pubkey);
		}

		const mutedByKindEvents = [...parameterizedReplaceableEvents]
			.map(([, event]) => event)
			.filter((event) => Number(event.kind) === 30007);
		storeMutedPubkeysByKind(mutedByKindEvents);

		// Channels
		const channelsEvent = replaceableEvents.get(10005);
		authorChannelsEventStore.set(channelsEvent);

		console.log('[relays]', get(readRelays), get(writeRelays));

		return contactsTags;
	}

	private async fetchAuthorEventsWithCache(pubkey: string): Promise<{
		replaceableEvents: Map<number, Event>;
		parameterizedReplaceableEvents: Map<string, Event>;
	}> {
		const storage = new WebStorage(localStorage);
		const cachedAt = storage.getCachedAt();
		if (cachedAt !== null) {
			console.log('[cached at]', new Date(cachedAt * 1000));
			const replaceableEvents = new Map(
				authorReplaceableKinds
					.filter(({ identifier }) => identifier === undefined)
					.map(({ kind }) => [kind, storage.getReplaceableEvent(kind)])
					.filter((x): x is [number, Event] => x[1] !== undefined)
			);
			console.log('[author events cache re]', replaceableEvents);
			const parameterizedReplaceableEvents = new Map(
				authorReplaceableKinds
					.filter(({ identifier }) => identifier !== undefined)
					.map(({ kind, identifier }) => {
						if (identifier === undefined) {
							throw new Error('Logic error');
						}
						return [
							`${kind}:${identifier}`,
							storage.getParameterizedReplaceableEvent(kind, identifier)
						];
					})
					.filter((x): x is [string, Event] => x[1] !== undefined)
			);
			console.log('[author events cache pre]', parameterizedReplaceableEvents);
			return { replaceableEvents, parameterizedReplaceableEvents };
		}

		console.log('[cached at]', cachedAt);

		const { replaceableEvents, parameterizedReplaceableEvents } =
			await this.fetchAuthorEvents(pubkey);
		for (const [, event] of [...replaceableEvents]) {
			storage.setReplaceableEvent(event, pubkey);
		}
		for (const [, event] of [...parameterizedReplaceableEvents]) {
			storage.setParameterizedReplaceableEvent(event, pubkey);
		}
		return { replaceableEvents, parameterizedReplaceableEvents };
	}

	private async fetchAuthorEvents(pubkey: string) {
		const replaceableEvents = new Map<number, Event>();
		const parameterizedReplaceableEvents = new Map<string, Event>();
		await new Promise<void>((resolve, reject) => {
			const authorReq = createRxBackwardReq();
			rxNostr
				.use(authorReq)
				.pipe(
					tie,
					uniq(),
					latestEach(({ event }) => `${event.kind}:${findIdentifier(event.tags) ?? ''}`)
				)
				.subscribe({
					next: (packet) => {
						console.log('[rx-nostr author]', packet);
						const { event } = packet;
						if (replaceableKinds.includes(event.kind)) {
							replaceableEvents.set(event.kind, event);
						} else if (parameterizedReplaceableKinds.includes(event.kind)) {
							parameterizedReplaceableEvents.set(
								`${event.kind}:${findIdentifier(event.tags) ?? ''}`,
								event
							);
						} else {
							console.error('[rx-nostr author logic error]', packet);
						}
					},
					complete: () => {
						console.log('[rx-nostr author complete]');
						resolve();
					},
					error: (error) => {
						console.error('[rx-nostr author error]', error);
						reject();
					}
				});
			authorReq.emit([
				{
					kinds: [...replaceableKinds, ...parameterizedReplaceableKinds],
					authors: [pubkey]
				}
			]);
			authorReq.over();
		});
		return { replaceableEvents, parameterizedReplaceableEvents };
	}
}
