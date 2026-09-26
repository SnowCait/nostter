import { get, writable, type Readable, type Writable } from 'svelte/store';
import escapeStringRegexp from 'escape-string-regexp';
import type { User } from '../../routes/types';
import type { Event } from 'nostr-tools';
import { defaultRelays } from '$lib/Constants';
import { getZapSenderPubkey } from '$lib/nostr/protocol/nip57';
import { getReadRelays, getWriteRelays, parseRelayList } from '$lib/nostr/protocol/nip65';
import type { ListContentDecrypter } from '$lib/List';
import { auth } from '$lib/auth.svelte';
import { prepareKindMuteStates } from '$lib/features/mute/application/prepare-mute-state';
import { regularMute } from '$lib/features/mute/application/regular-mute-state.svelte';

export const authorProfile: Writable<User> = writable();
export const metadataEvent: Writable<Event | undefined> = writable();
function projectRegularMute<T>(project: () => T): Readable<T> {
	return {
		subscribe(run) {
			run(project());
			return regularMute.subscribe(() => run(project()));
		}
	};
}

export const muteEvent = projectRegularMute(() => {
	const event = regularMute.state.regular.event;
	return event === undefined ? undefined : { ...event, tags: event.tags.map((tag) => [...tag]) };
});
export const mutePubkeys = projectRegularMute(() => [...regularMute.state.regular.tags.pubkeys]);
export const mutedPubkeysByKindMap = writable(new Map<number, Set<string>>());
export const muteEventIds = projectRegularMute(() => [...regularMute.state.regular.tags.eventIds]);
export const muteWords = projectRegularMute(() => [...regularMute.state.regular.tags.words]);
export const pinNotes: Writable<string[]> = writable([]);
export const readRelays: Writable<string[]> = writable(
	defaultRelays.filter((relay) => relay.read).map((relay) => relay.url)
);
export const writeRelays: Writable<string[]> = writable(
	defaultRelays.filter((relay) => relay.write).map((relay) => relay.url)
);
let mutePubkeysSetRef: readonly string[] | undefined;
let mutePubkeysSet = new Set<string>();
const getMutePubkeysSet = (): Set<string> => {
	const $mutePubkeys = regularMute.state.regular.tags.pubkeys;
	if ($mutePubkeys !== mutePubkeysSetRef) {
		mutePubkeysSetRef = $mutePubkeys;
		mutePubkeysSet = new Set($mutePubkeys);
	}
	return mutePubkeysSet;
};

let muteEventIdsSetRef: readonly string[] | undefined;
let muteEventIdsSet = new Set<string>();
const getMuteEventIdsSet = (): Set<string> => {
	const $muteEventIds = regularMute.state.regular.tags.eventIds;
	if ($muteEventIds !== muteEventIdsSetRef) {
		muteEventIdsSetRef = $muteEventIds;
		muteEventIdsSet = new Set($muteEventIds);
	}
	return muteEventIdsSet;
};

let muteWordsRegExpRef: readonly string[] | undefined;
let muteWordsRegExp: RegExp | undefined;
const getMuteWordsRegExp = (): RegExp | undefined => {
	const $muteWords = regularMute.state.regular.tags.words;
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

export const storeMutedPubkeysByKind = async (
	events: Event[],
	decryptPrivateListContent?: ListContentDecrypter
): Promise<void> => {
	const $mutedPubkeysByKindMap = get(mutedPubkeysByKindMap);
	const updates = await prepareKindMuteStates(events, decryptPrivateListContent);
	applyMutedPubkeysByKind(
		new Map([...updates].map(([kind, { pubkeys }]) => [kind, new Set(pubkeys)])),
		$mutedPubkeysByKindMap
	);
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
