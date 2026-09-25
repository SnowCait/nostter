import { Author } from '$lib/Author';
import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';
import { muteEvent } from '$lib/stores/Author';
import {
	prepareRegularMuteStateFromEvent,
	prepareKindMuteStates
} from '$lib/features/mute/application/prepare-mute-state';
import type { KindMuteState, RegularMuteState } from '$lib/features/mute/domain/mute-state';
import type { LoadedAccountEvents } from '$lib/Author';
import { unique } from '$lib/array';
import { parseFollowList } from '$lib/nostr/protocol/nip02';
import { loadFolloweesMetadataCache, pruneFolloweeReplaceableEventsCache } from '$lib/cache/Events';
import type { ListContentDecrypter } from '$lib/List';
import { prepareAccountState, type PreparedAccountState } from './prepare-account-state';

export type PreparedAccountMuteState = {
	mute: ({ type: 'apply' } & RegularMuteState & { event: Event }) | { type: 'unchanged' };
	mutedPubkeysByKind: Map<number, KindMuteState>;
};

export type PreparedAccountInitialization = {
	followingPubkeys: string[];
	accountState: PreparedAccountState;
	muteState: PreparedAccountMuteState;
};

export async function prepareAccountInitialization(
	pubkey: string,
	decryptPrivateListContent?: ListContentDecrypter
): Promise<PreparedAccountInitialization> {
	const author = new Author(pubkey);

	await author.fetchRelays();

	const events = await author.fetchEvents();
	const accountState = prepareAccountState(events);
	const muteState = await prepareAccountMuteState(pubkey, events, decryptPrivateListContent);
	const followingPubkeys = parseFollowList(accountState.contactsTags).map(({ pubkey }) => pubkey);
	const followees = unique([...followingPubkeys, pubkey]);

	await loadFolloweesMetadataCache(followees);
	pruneFolloweeReplaceableEventsCache(followees);

	return { followingPubkeys, accountState, muteState };
}

async function prepareAccountMuteState(
	pubkey: string,
	events: LoadedAccountEvents,
	decryptPrivateListContent?: ListContentDecrypter
): Promise<PreparedAccountMuteState> {
	const candidate = events.replaceableEvents.get(10000);
	const currentMuteEvent = get(muteEvent);
	let mute: PreparedAccountMuteState['mute'] = { type: 'unchanged' };
	if (
		candidate !== undefined &&
		(currentMuteEvent === undefined || candidate.created_at > currentMuteEvent.created_at)
	) {
		mute = {
			type: 'apply',
			...(await prepareRegularMuteStateFromEvent(
				candidate,
				pubkey,
				decryptPrivateListContent
			)),
			event: candidate
		};
	}

	const mutedByKindEvents = [...events.parameterizedReplaceableEvents.values()].filter(
		(event) => Number(event.kind) === 30007
	);
	const mutedPubkeysByKind = await prepareKindMuteStates(
		mutedByKindEvents,
		decryptPrivateListContent
	);
	return { mute, mutedPubkeysByKind };
}
