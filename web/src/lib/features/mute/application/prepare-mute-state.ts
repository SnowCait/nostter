import type { Event } from 'nostr-tools';
import { findIdentifier } from '$lib/nostr/protocol/event-address';
import { shouldReplaceCurrentEvent } from '$lib/nostr/protocol/replaceable-event';
import type { ListContentDecrypter } from '$lib/List';
import {
	prepareKindMuteState,
	prepareRegularMuteState,
	type KindMuteState,
	type RegularMuteState
} from '../domain/mute-state';

export async function prepareRegularMuteStateFromEvent(
	event: Event | undefined,
	accountPubkey: string,
	decryptPrivateListContent?: ListContentDecrypter
): Promise<RegularMuteState> {
	if (event === undefined) {
		return prepareRegularMuteState(undefined, accountPubkey);
	}
	const [privateTags] =
		decryptPrivateListContent === undefined
			? [[], false]
			: await decryptPrivateListContent(event.pubkey, event.content);
	return prepareRegularMuteState(event, accountPubkey, privateTags);
}

export async function prepareKindMuteStates(
	events: Event[],
	decryptPrivateListContent?: ListContentDecrypter
): Promise<Map<number, KindMuteState>> {
	const updates = new Map<number, KindMuteState>();
	for (const event of events) {
		const kind = findIdentifier(event.tags);
		if (kind === undefined || !/^\d+$/.test(kind) || !Number.isSafeInteger(Number(kind))) {
			continue;
		}
		const muteKind = Number(kind);
		const current = updates.get(muteKind);
		if (!shouldReplaceCurrentEvent(event, current?.event)) continue;
		try {
			updates.set(
				muteKind,
				await prepareKindMuteStateFromEvent(event, decryptPrivateListContent)
			);
		} catch (error) {
			console.warn('[kind 30007 content parse error]', event, error);
			updates.set(muteKind, prepareKindMuteState(event));
		}
	}
	return updates;
}

export async function prepareKindMuteStateFromEvent(
	event: Event,
	decryptPrivateListContent?: ListContentDecrypter
): Promise<KindMuteState> {
	if (event.content === '' || decryptPrivateListContent === undefined) {
		return prepareKindMuteState(event);
	}
	const [privateTags] = await decryptPrivateListContent(event.pubkey, event.content);
	return prepareKindMuteState(event, privateTags);
}
