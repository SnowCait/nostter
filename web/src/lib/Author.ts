import { Kind, type Event, type Filter } from 'nostr-tools';
import { get } from 'svelte/store';
import { Api } from './Api';
import { pool } from '../stores/Pool';
import {
	followees,
	recommendedRelay,
	readRelays,
	writeRelays,
	updateRelays,
	authorProfile,
	bookmarkEvent,
	mutePubkeys,
	muteEventIds,
	loginType
} from '../stores/Author';
import { RelaysFetcher } from './RelaysFetcher';
import { filterTags, parseRelayJson } from './EventHelper';
import { customEmojiTags, customEmojisEvent } from '../stores/CustomEmojis';
import { reactionEmoji } from '../stores/Preference';
import { Signer } from './Signer';

export class Author {
	constructor(private pubkey: string) {}

	public isRelated(event: Event): boolean {
		return event.tags.some(
			([tagName, tagContent]) => tagName === 'p' && tagContent === this.pubkey
		);
	}

	public isNotified(event: Event): boolean {
		return event.pubkey !== this.pubkey && this.isRelated(event);
	}

	public async fetchRelays(relays: string[]) {
		const relayEvents = await RelaysFetcher.fetchEvents(this.pubkey, relays);
		console.log('[relay events]', relayEvents);

		this.saveRelays(relayEvents);
	}

	public saveCustomEmojis(event: Event) {
		console.log('[custom emoji 10030]', event);
		const emojiTagsFilter = (tags: string[][]) => {
			return tags.filter(([tagName, shortcode, imageUrl]) => {
				if (tagName !== 'emoji') {
					return false;
				}
				if (shortcode === undefined || imageUrl === undefined) {
					return false;
				}
				if (!/^\w+$/.test(shortcode)) {
					return false;
				}
				try {
					new URL(imageUrl);
					return true;
				} catch {
					return false;
				}
			});
		};

		// emoji tags
		customEmojiTags.set(emojiTagsFilter(event.tags));
		const $customEmojiTags = get(customEmojiTags);

		// a tags
		const referenceTags = event.tags.filter(([tagName]) => tagName === 'a');
		if (referenceTags.length > 0) {
			const filters: Filter[] = referenceTags
				.map(([, reference]) => reference.split(':'))
				.filter(([kind]) => kind === `${30030 as Kind}`)
				.map(([kind, pubkey, identifier]) => {
					return {
						kinds: [Number(kind)],
						authors: [pubkey],
						'#d': [identifier]
					};
				});
			console.debug('[custom emoji #a]', referenceTags, filters);
			const api = new Api(get(pool), get(writeRelays));
			api.fetchEvents(filters).then((events) => {
				console.debug('[custom emoji 30030]', events);
				for (const event of events) {
					$customEmojiTags.push(...emojiTagsFilter(event.tags));
				}
				customEmojiTags.set($customEmojiTags);
				console.log('[custom emoji tags]', $customEmojiTags);
			});
		}
	}

	// TODO: Ensure created_at
	public saveRelays(replaceableEvents: Map<Kind, Event>) {
		const recommendedRelayEvent = replaceableEvents.get(Kind.RecommendRelay);
		if (recommendedRelayEvent !== undefined) {
			recommendedRelay.set(recommendedRelayEvent.content);
			console.log('[recommended relay]', get(recommendedRelay));
		}

		const contactsEvent = replaceableEvents.get(Kind.Contacts);
		if (contactsEvent !== undefined) {
			const pubkeys = new Set(filterTags('p', contactsEvent.tags));
			pubkeys.add(this.pubkey); // Add myself
			followees.set(Array.from(pubkeys));
			console.log('[contacts]', pubkeys);

			if (contactsEvent.content === '') {
				console.log('[relays in kind 3] empty');
			} else {
				const validRelays = [...parseRelayJson(contactsEvent.content)];
				console.log(validRelays, pubkeys);
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
		if (
			relayListEvent !== undefined &&
			(contactsEvent === undefined ||
				contactsEvent.content === '' ||
				contactsEvent.created_at < relayListEvent.created_at)
		) {
			updateRelays(relayListEvent);
			console.log('[relays in kind 10002]', get(readRelays), get(writeRelays));
		}
	}

	public async fetchEvents(): Promise<void> {
		const api = new Api(get(pool), get(writeRelays));
		const { replaceableEvents, parameterizedReplaceableEvents } = await api.fetchAuthorEvents(
			this.pubkey
		);

		const metadataEvent = replaceableEvents.get(Kind.Metadata);
		if (metadataEvent !== undefined) {
			try {
				authorProfile.set(JSON.parse(metadataEvent.content));
				console.log('[profile]', get(authorProfile));
			} catch (error) {
				console.warn('[invalid metadata]', error, metadataEvent);
			}
		}

		this.saveRelays(replaceableEvents);

		customEmojisEvent.set(replaceableEvents.get(10030 as Kind));
		const $customEmojisEvent = get(customEmojisEvent);
		if ($customEmojisEvent !== undefined) {
			this.saveCustomEmojis($customEmojisEvent);
		}

		bookmarkEvent.set(parameterizedReplaceableEvents.get(`${30001 as Kind}:bookmark`));

		const reactionEmojiEvent = parameterizedReplaceableEvents.get(
			`${30078 as Kind}:nostter-reaction-emoji`
		);
		if (reactionEmojiEvent !== undefined) {
			reactionEmoji.set(reactionEmojiEvent.content);
			console.log('[reaction emoji]', get(reactionEmoji));
		}

		const muteEvent = replaceableEvents.get(10000 as Kind);
		const regacyMuteEvent = parameterizedReplaceableEvents.get(`${30000 as Kind}:mute`);

		let modernMutePubkeys: string[] = [];
		let modernMuteEventIds: string[] = [];
		let regacyMutePubkeys: string[] = [];
		let regacyMuteEventIds: string[] = [];

		if (muteEvent !== undefined) {
			const muteLists = await this.getMuteLists(muteEvent);
			modernMutePubkeys = muteLists.pubkeys;
			modernMuteEventIds = muteLists.eventIds;
		}

		if (regacyMuteEvent !== undefined) {
			const muteLists = await this.getMuteLists(regacyMuteEvent);
			regacyMutePubkeys = muteLists.pubkeys;
			regacyMuteEventIds = muteLists.eventIds;
		}

		mutePubkeys.set(Array.from(new Set([...modernMutePubkeys, ...regacyMutePubkeys])));
		console.log('[mute pubkeys]', get(mutePubkeys));

		muteEventIds.set(Array.from(new Set([...modernMuteEventIds, ...regacyMuteEventIds])));
		console.log('[mute eventIds]', get(muteEventIds));

		console.log('[relays]', get(readRelays), get(writeRelays));
	}

	private async getMuteLists(event: Event) {
		let publicMutePubkeys: string[] = [];
		let publicMuteEventIds: string[] = [];
		let privateMutePubkeys: string[] = [];
		let privateMuteEventIds: string[] = [];

		publicMutePubkeys = filterTags('p', event.tags);
		publicMuteEventIds = filterTags('e', event.tags);

		const $loginType = get(loginType);
		if (($loginType === 'NIP-07' || $loginType === 'nsec') && event.content !== '') {
			try {
				const json = await Signer.decrypt(this.pubkey, event.content);
				const tags = JSON.parse(json) as string[][];
				privateMutePubkeys = filterTags('p', tags);
				privateMuteEventIds = filterTags('e', tags);
			} catch (error) {
				console.error('[NIP-07 nip04.decrypt()]', error);
			}
		}

		console.log('[mute p list]', publicMutePubkeys, privateMutePubkeys);
		console.log('[mute e list]', publicMuteEventIds, privateMuteEventIds);

		return {
			pubkeys: Array.from(new Set([...publicMutePubkeys, ...privateMutePubkeys])),
			eventIds: Array.from(new Set([...publicMuteEventIds, ...privateMuteEventIds]))
		};
	}
}
