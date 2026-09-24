import { get } from 'svelte/store';
import { applyMuteTags, muteEvent, mutedPubkeysByKindMap } from '$lib/stores/Author';
import { applyAccountChannels, applyAccountState } from './apply-account-state';
import type { PreparedAccountInitialization } from './initialize-account';

export function applyAccountInitialization(
	pubkey: string,
	prepared: PreparedAccountInitialization
): void {
	applyAccountState(pubkey, prepared.accountState);

	const currentMuteEvent = get(muteEvent);
	const preparedMuteEvent = prepared.muteState.mute.event;
	const newerSameAccountMuteEvent =
		preparedMuteEvent !== undefined &&
		currentMuteEvent?.pubkey === pubkey &&
		currentMuteEvent.created_at >= preparedMuteEvent.created_at;
	if (!newerSameAccountMuteEvent) {
		muteEvent.set(preparedMuteEvent);
		applyMuteTags(prepared.muteState.mute.tags);
	}

	mutedPubkeysByKindMap.set(new Map(prepared.muteState.mutedPubkeysByKind));
	applyAccountChannels(prepared.accountState);
}
