import type { Event } from 'nostr-tools';
import { findIdentifier } from '$lib/nostr/protocol/event-address';
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
		if (!kind || isNaN(Number(kind))) {
			continue;
		}
		const privateTags: string[][] = [];
		if (event.content !== '' && decryptPrivateListContent !== undefined) {
			try {
				const [tags] = await decryptPrivateListContent(event.pubkey, event.content);
				privateTags.push(...tags);
			} catch (error) {
				console.warn('[kind 30007 content parse error]', event, error);
			}
		}
		updates.set(Number(kind), prepareKindMuteState(event, privateTags));
	}
	return updates;
}
