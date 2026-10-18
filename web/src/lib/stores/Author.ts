import { toStore, writable, type Writable } from 'svelte/store';
import type { User } from '../../routes/types';
import type { Event } from 'nostr-tools';
import { getZapSenderPubkey } from '$lib/nostr/protocol/nip57';
import { auth } from '$lib/auth.svelte';
import { isKindMutedPubkey } from '$lib/features/mute/application/kind-mute-runtime.svelte';
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
export const pinNotes: Writable<string[]> = writable([]);
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

	if (event.kind === 9735) {
		const zapperPubkey = getZapSenderPubkey(event);
		if (zapperPubkey !== undefined && isKindMutedPubkey(event.kind, zapperPubkey)) {
			return true;
		}
	} else if (isKindMutedPubkey(event.kind, event.pubkey)) {
		return true;
	}

	if (isRegularMutedWord(event.content)) {
		return true;
	}

	return (
		isRegularMutedEventId(event.id) ||
		event.tags.some(([tagName, id]) => tagName === 'e' && isRegularMutedEventId(id))
	);
};
