import { get, toStore, writable, type Writable } from 'svelte/store';
import type { User } from '../../routes/types';
import type { Event } from 'nostr-tools';
import { defaultRelays } from '$lib/Constants';
import { getZapSenderPubkey } from '$lib/nostr/protocol/nip57';
import { getReadRelays, getWriteRelays, parseRelayList } from '$lib/nostr/protocol/nip65';
import { auth } from '$lib/auth.svelte';
import type { ListContentDecrypter } from '$lib/List';
import { prepareKindMuteStates } from '$lib/features/mute/application/prepare-mute-state';
import {
	getCanonicalMuteEvent,
	getEffectiveMuteTags,
	isRegularMutedEventId,
	isRegularMutedPubkey,
	isRegularMutedWord
} from '$lib/features/mute/application/regular-mute-runtime.svelte';

export const muteEvent = toStore(getCanonicalMuteEvent);
export const mutePubkeys = toStore(() => [...getEffectiveMuteTags().pubkeys]);
export const muteEventIds = toStore(() => [...getEffectiveMuteTags().eventIds]);
export const muteWords = toStore(() => [...getEffectiveMuteTags().words]);

export const authorProfile: Writable<User> = writable();
export const metadataEvent: Writable<Event | undefined> = writable();
export const mutedPubkeysByKindMap = writable(new Map<number, Set<string>>());
export const pinNotes: Writable<string[]> = writable([]);
export const readRelays: Writable<string[]> = writable(
	defaultRelays.filter((relay) => relay.read).map((relay) => relay.url)
);
export const writeRelays: Writable<string[]> = writable(
	defaultRelays.filter((relay) => relay.write).map((relay) => relay.url)
);
export const isMutePubkey = (pubkey: string) => isRegularMutedPubkey(pubkey);
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

	if (isRegularMutedWord(event.content)) {
		return true;
	}

	return (
		isRegularMutedEventId(event.id) ||
		event.tags.some(([tagName, id]) => tagName === 'e' && isRegularMutedEventId(id))
	);
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
