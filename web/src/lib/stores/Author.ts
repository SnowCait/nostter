import { get, writable, type Writable } from 'svelte/store';
import escapeStringRegexp from 'escape-string-regexp';
import type { User } from '../../routes/types';
import type { Event } from 'nostr-tools';
import { defaultRelays } from '$lib/Constants';
import { getZapSenderPubkey } from '$lib/nostr/protocol/nip57';
import { getReadRelays, getWriteRelays, parseRelayList } from '$lib/nostr/protocol/nip65';
import type { ListContentDecrypter } from '$lib/List';
import { auth } from '$lib/auth.svelte';
import {
	prepareMuteTags,
	prepareMuteTagsFromEvent,
	prepareMutedPubkeysByKind,
	type PreparedMuteTags
} from '$lib/features/mute/application/prepare-mute-state';

export const authorProfile: Writable<User> = writable();
export const metadataEvent: Writable<Event | undefined> = writable();
export const muteEvent = writable<Event | undefined>();
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
let mutePubkeysSetRef: string[] | undefined;
let mutePubkeysSet = new Set<string>();
const getMutePubkeysSet = (): Set<string> => {
	const $mutePubkeys = get(mutePubkeys);
	if ($mutePubkeys !== mutePubkeysSetRef) {
		mutePubkeysSetRef = $mutePubkeys;
		mutePubkeysSet = new Set($mutePubkeys);
	}
	return mutePubkeysSet;
};

let muteEventIdsSetRef: string[] | undefined;
let muteEventIdsSet = new Set<string>();
const getMuteEventIdsSet = (): Set<string> => {
	const $muteEventIds = get(muteEventIds);
	if ($muteEventIds !== muteEventIdsSetRef) {
		muteEventIdsSetRef = $muteEventIds;
		muteEventIdsSet = new Set($muteEventIds);
	}
	return muteEventIdsSet;
};

let muteWordsRegExpRef: string[] | undefined;
let muteWordsRegExp: RegExp | undefined;
const getMuteWordsRegExp = (): RegExp | undefined => {
	const $muteWords = get(muteWords);
	if ($muteWords !== muteWordsRegExpRef) {
		muteWordsRegExpRef = $muteWords;
		muteWordsRegExp =
			$muteWords.length > 0
				? new RegExp(
						`(${$muteWords.map((word) => escapeStringRegexp(word)).join('|')})`,
						'i'
					)
				: undefined;
	}
	return muteWordsRegExp;
};

export const isMutePubkey = (pubkey: string) => getMutePubkeysSet().has(pubkey);
export const isMuteEvent = (event: Event) => {
	// Avoid being muted if content contains muted words
	if (event.pubkey === auth.pubkey) {
		return false;
	}

	if (event.kind === 9735) {
		const zapperPubkey = getZapSenderPubkey(event);
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
			const zapperPubkey = getZapSenderPubkey(event);
			if (zapperPubkey !== undefined && mutedPubkeysByKind.has(zapperPubkey)) {
				return true;
			}
		} else if (mutedPubkeysByKind.has(event.pubkey)) {
			return true;
		}
	}

	const muteWordsPattern = getMuteWordsRegExp();
	if (muteWordsPattern !== undefined && muteWordsPattern.test(event.content)) {
		return true;
	}

	const ids = getMuteEventIdsSet();
	return ids.has(event.id) || event.tags.some(([tagName, id]) => tagName === 'e' && ids.has(id));
};

export const updateRelays = (event: Event) => {
	console.debug('[relays before]', get(readRelays), get(writeRelays));
	const entries = parseRelayList(event.tags);
	readRelays.set([...new Set(getReadRelays(entries))]);
	writeRelays.set([...new Set(getWriteRelays(entries))]);
	console.debug('[relays after]', get(readRelays), get(writeRelays));
};

export const storeMutedTagsByEvent = async (
	event: Event,
	accountPubkey: string,
	decryptPrivateListContent?: ListContentDecrypter
): Promise<void> => {
	const $muteEvent = get(muteEvent);
	if ($muteEvent !== undefined && event.created_at <= $muteEvent.created_at) {
		return;
	}
	muteEvent.set(event);
	const prepared = await prepareMuteTagsFromEvent(
		event,
		accountPubkey,
		decryptPrivateListContent
	);
	applyMuteTags(prepared);
};

export const storeMutedTags = async (tags: string[][], accountPubkey: string): Promise<void> => {
	applyMuteTags(prepareMuteTags(tags, accountPubkey));
};

export const applyMuteTags = (state: PreparedMuteTags): void => {
	mutePubkeys.set(state.pubkeys);
	muteEventIds.set(state.eventIds);
	muteWords.set(state.words);
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

export const storeMutedPubkeysByKind = async (
	events: Event[],
	decryptPrivateListContent?: ListContentDecrypter
): Promise<void> => {
	const $mutedPubkeysByKindMap = get(mutedPubkeysByKindMap);
	const updates = await prepareMutedPubkeysByKind(events, decryptPrivateListContent);
	applyMutedPubkeysByKind(updates, $mutedPubkeysByKindMap);
};

export const applyMutedPubkeysByKind = (
	updates: Map<number, Set<string>>,
	state: Map<number, Set<string>> = get(mutedPubkeysByKindMap)
): void => {
	for (const [kind, pubkeys] of updates) {
		state.set(kind, pubkeys);
	}
	mutedPubkeysByKindMap.set(state);
	console.log('[mute by kind]', state);
};
