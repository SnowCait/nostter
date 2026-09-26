import { Author } from '$lib/Author';
import {
	regularMute,
	type RegularMuteInitializationBaseline
} from '$lib/features/mute/application/regular-mute-state.svelte';
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
	mute: RegularMuteState;
	baseline: RegularMuteInitializationBaseline;
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
	const muteBaseline = regularMute.captureInitializationBaseline();
	const author = new Author(pubkey);

	await author.fetchRelays();

	const events = await author.fetchEvents();
	const accountState = prepareAccountState(events);
	const muteState = await prepareAccountMuteState(
		pubkey,
		events,
		muteBaseline,
		decryptPrivateListContent
	);
	const followingPubkeys = parseFollowList(accountState.contactsTags).map(({ pubkey }) => pubkey);
	const followees = unique([...followingPubkeys, pubkey]);

	await loadFolloweesMetadataCache(followees);
	pruneFolloweeReplaceableEventsCache(followees);

	return { followingPubkeys, accountState, muteState };
}

async function prepareAccountMuteState(
	pubkey: string,
	events: LoadedAccountEvents,
	baseline: RegularMuteInitializationBaseline,
	decryptPrivateListContent?: ListContentDecrypter
): Promise<PreparedAccountMuteState> {
	const candidate = events.replaceableEvents.get(10000);
	const mute = await prepareRegularMuteStateFromEvent(
		candidate?.pubkey === pubkey ? candidate : undefined,
		pubkey,
		decryptPrivateListContent
	);

	const mutedByKindEvents = [...events.parameterizedReplaceableEvents.values()].filter(
		(event) => Number(event.kind) === 30007
	);
	const mutedPubkeysByKind = await prepareKindMuteStates(
		mutedByKindEvents,
		decryptPrivateListContent
	);
	return { mute, baseline, mutedPubkeysByKind };
}
