import { storeMutedPubkeysByKind, storeMutedTagsByEvent } from '$lib/stores/Author';
import type { ListContentDecrypter } from '$lib/List';
import type { LoadedAccountEvents } from '$lib/Author';
import { applyAccountChannels, applyAccountState } from './apply-account-state';
import { prepareAccountState } from './prepare-account-state';

export async function applyAccountEvents(
	pubkey: string,
	events: LoadedAccountEvents,
	decryptPrivateListContent?: ListContentDecrypter
): Promise<string[][]> {
	const state = prepareAccountState(events);
	applyAccountState(pubkey, state);

	const muteEvent = events.replaceableEvents.get(10000);
	if (muteEvent !== undefined) {
		await storeMutedTagsByEvent(muteEvent, pubkey, decryptPrivateListContent);
	}

	const mutedByKindEvents = [...events.parameterizedReplaceableEvents]
		.map(([, event]) => event)
		.filter((event) => Number(event.kind) === 30007);
	await storeMutedPubkeysByKind(mutedByKindEvents, decryptPrivateListContent);

	applyAccountChannels(state);
	return state.contactsTags;
}
