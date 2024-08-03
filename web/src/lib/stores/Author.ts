import { get, writable, type Writable } from 'svelte/store';
import escapeStringRegexp from 'escape-string-regexp';
import type { User } from '../../routes/types';
import type { Event } from 'nostr-tools';
import { defaultRelays } from '$lib/Constants';
import type { Author } from '$lib/Author';
import { filterRelayTags, filterTags, findIdentifier, getZapperPubkey } from '$lib/EventHelper';
import { Signer } from '$lib/Signer';
import { decryptListContent } from '$lib/List';

console.log('[author store]');

export const loginType: Writable<'NIP-07' | 'nsec' | 'npub'> = writable();
export const pubkey = writable('');
export const author: Writable<Author | undefined> = writable();
export const authorProfile: Writable<User> = writable();
export const metadataEvent: Writable<Event | undefined> = writable();
export const followees: Writable<string[]> = writable([]);
export const originalFollowees = writable<string[]>([]);
export const mutePubkeys: Writable<string[]> = writable([]);
export const mutedPubkeysByKindMap = writable(new Map<number, Set<string>>());
export const muteEventIds: Writable<string[]> = writable([]);
export const muteWords: Writable<string[]> = writable([]);
export const pinNotes: Writable<string[]> = writable([]);
export const readRelays: Writable<string[]> = writable(
	defaultRelays.filter((relay) => relay.read).map((relay) => relay.url)
);
export const writeRelays: Writable<string[]> = writable(
	defaultRelays.filter((relay) => relay.write).map((relay) => relay.url)
);
export const rom = writable(false);

export const isMutePubkey = (pubkey: string) => get(mutePubkeys).includes(pubkey);
export const isMuteEvent = (event: Event) => {
	if (event.pubkey === get(pubkey)) {
		return false;
	}

	if (event.kind === 9735) {
		const zapperPubkey = getZapperPubkey(event);
		if (zapperPubkey !== undefined && isMutePubkey(zapperPubkey)) {
			return true;
		}
	} else {
		if (
			isMutePubkey(event.pubkey) ||
			event.tags.some(([tagName, pubkey]) => tagName === 'p' && isMutePubkey(pubkey))
		) {
			return true;
		}
	}

	const $mutedPubkeysByKindMap = get(mutedPubkeysByKindMap);
	const mutedPubkeysByKind = $mutedPubkeysByKindMap.get(event.kind);
	if (mutedPubkeysByKind !== undefined) {
		if (event.kind === 9735) {
			const zapperPubkey = getZapperPubkey(event);
			if (zapperPubkey !== undefined && mutedPubkeysByKind.has(zapperPubkey)) {
				return true;
			}
		} else if (mutedPubkeysByKind.has(event.pubkey)) {
			return true;
		}
	}

	const $muteWords = get(muteWords);
	if (
		$muteWords.length > 0 &&
		new RegExp(`(${$muteWords.map((word) => escapeStringRegexp(word)).join('|')})`, 'i').test(
			event.content
		)
	) {
		return true;
	}

	const ids = get(muteEventIds);
	return (
		ids.includes(event.id) ||
		event.tags.some(([tagName, id]) => tagName === 'e' && ids.includes(id))
	);
};

export const updateRelays = (event: Event) => {
	console.debug('[relays before]', get(readRelays), get(writeRelays));
	const validRelayTags = filterRelayTags(event.tags);
	readRelays.set(
		Array.from(
			new Set(
				validRelayTags
					.filter(([, , permission]) => permission === undefined || permission === 'read')
					.map(([, relay]) => relay)
			)
		)
	);
	writeRelays.set(
		Array.from(
			new Set(
				validRelayTags
					.filter(
						([, , permission]) => permission === undefined || permission === 'write'
					)
					.map(([, relay]) => relay)
			)
		)
	);
	console.debug('[relays after]', get(readRelays), get(writeRelays));
};

export const storeMutedTagsByEvent = async (event: Event): Promise<void> => {
	const privateTags = await decryptListContent(event.content);
	await storeMutedTags([...event.tags, ...privateTags]);
};

export const storeMutedTags = async (tags: string[][]): Promise<void> => {
	mutePubkeys.set([...new Set(filterTags('p', tags))]);
	muteEventIds.set([...new Set(filterTags('e', tags))]);
	muteWords.set([...new Set(filterTags('word', tags))]);
	console.log(
		'[mute lists]',
		'p',
		get(mutePubkeys),
		'e',
		get(muteEventIds),
		'word',
		get(muteWords)
	);
};

export const storeMutedPubkeysByKind = async (events: Event[]): Promise<void> => {
	const $mutedPubkeysByKindMap = get(mutedPubkeysByKindMap);
	for (const event of events) {
		const kind = findIdentifier(event.tags);
		if (!kind || isNaN(Number(kind))) {
			continue;
		}
		const privateTags: string[][] = [];
		if (event.content !== '') {
			try {
				const content = await Signer.decrypt(event.pubkey, event.content);
				const tags = JSON.parse(content) as string[][];
				privateTags.push(...tags);
			} catch (error) {
				console.warn('[kind 30007 content parse error]', event);
			}
		}
		const pubkeys = filterTags('p', [...event.tags, ...privateTags]);
		$mutedPubkeysByKindMap.set(Number(kind), new Set(pubkeys));
	}
	mutedPubkeysByKindMap.set($mutedPubkeysByKindMap);
	console.log('[mute by kind]', $mutedPubkeysByKindMap);
};
