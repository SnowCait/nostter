import { Author } from '$lib/Author';
import {
	prepareRegularMuteStateFromEvent,
	prepareKindMuteStates
} from '$lib/features/mute/application/prepare-mute-state';
import {
	mute,
	type MuteInitializationBaseline,
	type MuteSnapshot
} from '$lib/features/mute/application/mute-state.svelte';
import type { LoadedAccountEvents } from '$lib/Author';
import { unique } from '$lib/array';
import { parseFollowList } from '$lib/nostr/protocol/nip02';
import { loadFolloweesMetadataCache, pruneFolloweeReplaceableEventsCache } from '$lib/cache/Events';
import type { ListContentDecrypter } from '$lib/List';
import { prepareAccountState, type PreparedAccountState } from './prepare-account-state';

export type PreparedAccountMuteState = {
	snapshot: MuteSnapshot;
	baseline: MuteInitializationBaseline;
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
	const muteBaseline = mute.captureInitializationBaseline();
	const author = new Author(pubkey);

	await author.fetchRelays();

	const events = await author.fetchEvents();
	const accountState = prepareAccountState(events);
	const muteState = {
		snapshot: await prepareAccountMuteState(pubkey, events, decryptPrivateListContent),
		baseline: muteBaseline
	};
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
): Promise<MuteSnapshot> {
	const loadedRegular = events.replaceableEvents.get(10000);
	const candidate = loadedRegular?.pubkey === pubkey ? loadedRegular : undefined;
	const regular = await prepareRegularMuteStateFromEvent(
		candidate,
		pubkey,
		decryptPrivateListContent
	);

	const mutedByKindEvents = [...events.parameterizedReplaceableEvents.values()].filter(
		(event) => Number(event.kind) === 30007 && event.pubkey === pubkey
	);
	const byKind = await prepareKindMuteStates(mutedByKindEvents, decryptPrivateListContent);
	return { regular, byKind };
}
