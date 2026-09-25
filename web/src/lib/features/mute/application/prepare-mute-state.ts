import type { Event } from 'nostr-tools';
import type { ListContentDecrypter } from '$lib/List';
import {
	getKindMuteTarget,
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

export async function prepareKindMuteStateFromEvent(
	event: Event,
	decryptPrivateListContent?: ListContentDecrypter
): Promise<KindMuteState | undefined> {
	if (getKindMuteTarget(event) === undefined) {
		return undefined;
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
	return prepareKindMuteState(event, privateTags);
}

export async function prepareKindMuteStates(
	events: Event[],
	decryptPrivateListContent?: ListContentDecrypter
): Promise<Map<number, KindMuteState>> {
	const updates = new Map<number, KindMuteState>();
	for (const event of events) {
		const kind = getKindMuteTarget(event);
		if (kind === undefined) continue;
		const prepared = await prepareKindMuteStateFromEvent(event, decryptPrivateListContent);
		if (prepared !== undefined) updates.set(kind, prepared);
	}
	return updates;
}
