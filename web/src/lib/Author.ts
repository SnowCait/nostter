import { Kind, type Event } from 'nostr-tools';
import { get } from 'svelte/store';
import { createRxBackwardReq, createRxOneshotReq, latest, latestEach, now, uniq } from 'rx-nostr';
import { firstValueFrom, EmptyError } from 'rxjs';
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
import { filterTags, findIdentifier, parseRelayJson } from './EventHelper';
import { customEmojisEvent, storeCustomEmojis } from './author/CustomEmojis';
import type { User } from '../routes/types';
import { lastReadAt } from './stores/Notifications';
import { Mute } from './Mute';
import { WebStorage } from './WebStorage';
import { Preferences, preferencesStore } from './Preferences';
import { rxNostr } from './timelines/MainTimeline';
import { Signer } from './Signer';
import { authorChannelsEventStore } from './cache/Events';
import { updateFolloweesStore } from './Contacts';
import {
	authorReplaceableKinds,
	parameterizedReplaceableKinds,
	replaceableKinds
} from './Constants';
import { bookmarkEvent } from './author/Bookmark';
import { profileBadgesEvent, profileBadgesKey } from './author/ProfileBadges';

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
	public storeRelays(replaceableEvents: Map<Kind, Event>) {
		const contactsEvent = replaceableEvents.get(Kind.Contacts);
		if (contactsEvent !== undefined) {
			updateFolloweesStore(contactsEvent.tags);

			if (contactsEvent.content === '') {
				console.log('[relays in kind 3] empty');
			} else {
				const validRelays = [...parseRelayJson(contactsEvent.content)];
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
		} else {
			updateFolloweesStore([]);
		}

		const relayListEvent = replaceableEvents.get(Kind.RelayList);
		if (relayListEvent !== undefined) {
			updateRelays(relayListEvent);
			console.log('[relays in kind 10002]', get(readRelays), get(writeRelays));
		}
	}

	public async fetchEvents(): Promise<void> {
		const { replaceableEvents, parameterizedReplaceableEvents } =
			await this.fetchAuthorEventsWithCache(this.pubkey);

		const $metadataEvent = replaceableEvents.get(Kind.Metadata);
		if ($metadataEvent !== undefined) {
			metadataEvent.set($metadataEvent);
			try {
				authorProfile.set(JSON.parse($metadataEvent.content));
			} catch (error) {
				console.warn('[invalid metadata]', error, $metadataEvent);
			}
		} else {
			authorProfile.set({} as User);
		}
		console.log('[profile]', get(authorProfile));

		this.storeRelays(replaceableEvents);

		customEmojisEvent.set(replaceableEvents.get(10030 as Kind));
		const $customEmojisEvent = get(customEmojisEvent);
		if ($customEmojisEvent !== undefined) {
			storeCustomEmojis($customEmojisEvent);
		}

		bookmarkEvent.set(parameterizedReplaceableEvents.get(`${30001 as Kind}:bookmark`));
		profileBadgesEvent.set(parameterizedReplaceableEvents.get(profileBadgesKey));

		const preferencesEvent = parameterizedReplaceableEvents.get(
			`${30078 as Kind}:nostter-preferences`
		);
		if (preferencesEvent !== undefined) {
			const preferences = new Preferences(preferencesEvent.content);
			preferencesStore.set(preferences);
		} else {
			const regacyReactionEmojiEvent = parameterizedReplaceableEvents.get(
				`${30078 as Kind}:nostter-reaction-emoji`
			);
			if (regacyReactionEmojiEvent !== undefined) {
				console.log('[preferences from regacy event]', regacyReactionEmojiEvent);
				const preferences = new Preferences('{}');
				preferences.reactionEmoji = { content: regacyReactionEmojiEvent.content };
				preferencesStore.set(preferences);
			}
		}

		const lastReadEvent = parameterizedReplaceableEvents.get(`${30078 as Kind}:nostter-read`);
		const regacyLastReadEvent = parameterizedReplaceableEvents.get(
			`${30000 as Kind}:notifications/lastOpened`
		);
		if (lastReadEvent !== undefined) {
			lastReadAt.set(lastReadEvent.created_at);
		} else if (regacyLastReadEvent !== undefined) {
			lastReadAt.set(regacyLastReadEvent.created_at);
		} else {
			lastReadAt.set(now() - 12 * 60 * 60);
		}
		console.log('[last read at]', new Date(get(lastReadAt) * 1000));

		const muteEvent = replaceableEvents.get(10000 as Kind);
		const legacyMuteEvent = parameterizedReplaceableEvents.get(`${30000 as Kind}:mute`);

		if (muteEvent !== undefined) {
			await storeMutedTagsByEvent(muteEvent);
		} else if (legacyMuteEvent !== undefined) {
			await new Mute().migrate(legacyMuteEvent, muteEvent);
		}

		const mutedByKindEvents = [...parameterizedReplaceableEvents]
			.map(([, event]) => event)
			.filter((event) => Number(event.kind) === 30007);
		storeMutedPubkeysByKind(mutedByKindEvents);

		// Channels
		const pinEvent = replaceableEvents.get(10001 as Kind);
		const channelsEvent = replaceableEvents.get(10005 as Kind);
		authorChannelsEventStore.set(channelsEvent);
		if (channelsEvent === undefined && pinEvent !== undefined) {
			await this.migrateChannels(pinEvent);
		}

		console.log('[relays]', get(readRelays), get(writeRelays));
	}

	private async fetchAuthorEventsWithCache(pubkey: string): Promise<{
		replaceableEvents: Map<Kind, Event>;
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
			storage.setReplaceableEvent(event);
		}
		for (const [, event] of [...parameterizedReplaceableEvents]) {
			storage.setParameterizedReplaceableEvent(event);
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

	private async migrateChannels(regacyChannelsEvent: Event) {
		console.log('[channels migration]', regacyChannelsEvent);

		const ids = filterTags('e', regacyChannelsEvent.tags);
		if (ids.length === 0) {
			return;
		}

		const storage = new WebStorage(localStorage);

		try {
			const channelsReq = createRxOneshotReq({
				filters: {
					kinds: [10005],
					authors: [regacyChannelsEvent.pubkey]
				}
			});
			const packet = await firstValueFrom(rxNostr.use(channelsReq).pipe(uniq(), latest()));
			console.log('[channels event]', packet);
			storage.setReplaceableEvent(packet.event);
			authorChannelsEventStore.set(packet.event);
			return; // Already migrated
		} catch (error) {
			if (!(error instanceof EmptyError)) {
				throw error;
			}
		}

		const channelIds = new Set<string>();
		const channelsMetadataReq = createRxOneshotReq({
			filters: [
				{
					kinds: [40],
					ids
				}
			]
		});
		rxNostr
			.use(channelsMetadataReq)
			.pipe(uniq())
			.subscribe({
				next: (packet) => {
					console.log('[channel metadata next]', packet);
					channelIds.add(packet.event.id);
				},
				complete: async () => {
					console.log('[channels metadata complete]');

					if (channelIds.size === 0) {
						return;
					}

					const event = await Signer.signEvent({
						kind: 10005,
						content: '',
						tags: regacyChannelsEvent.tags.filter(
							([tagName, id]) => tagName === 'e' && channelIds.has(id)
						),
						created_at: now()
					});
					rxNostr.send(event).subscribe((packet) => {
						console.log('[channels migration send]', packet);
						if (packet.ok) {
							storage.setReplaceableEvent(event);
							authorChannelsEventStore.set(event);
						}
					});

					const pinEvent = await Signer.signEvent({
						kind: regacyChannelsEvent.kind,
						content: regacyChannelsEvent.content,
						tags: regacyChannelsEvent.tags.filter(
							([tagName, id]) => !(tagName === 'e' && channelIds.has(id))
						),
						created_at: now()
					});
					rxNostr.send(pinEvent).subscribe((packet) => {
						console.log('[channels migration send pin]', packet);
						storage.setReplaceableEvent(pinEvent);
					});
				}
			});
	}
}
