import { get } from 'svelte/store';
import {
	applyMuteTags,
	applyMutedPubkeysByKind,
	muteEvent,
	mutedPubkeysByKindMap
} from '$lib/stores/Author';
import { applyAccountChannels, applyAccountState } from './apply-account-state';
import type { PreparedAccountInitialization } from './initialize-account';

export function applyAccountInitialization(
	pubkey: string,
	prepared: PreparedAccountInitialization
): void {
	applyAccountState(pubkey, prepared.accountState);

	if (prepared.muteState.mute.type === 'apply') {
		const currentMuteEvent = get(muteEvent);
		if (
			currentMuteEvent === undefined ||
			prepared.muteState.mute.event.created_at > currentMuteEvent.created_at
		) {
			muteEvent.set(prepared.muteState.mute.event);
			applyMuteTags(prepared.muteState.mute.tags);
		}
	}

	applyMutedPubkeysByKind(prepared.muteState.mutedPubkeysByKind, get(mutedPubkeysByKindMap));
	applyAccountChannels(prepared.accountState);
}
