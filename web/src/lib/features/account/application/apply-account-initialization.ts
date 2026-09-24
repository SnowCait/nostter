import { get } from 'svelte/store';
import { applyMuteTags, muteEvent, mutedPubkeysByKindMap } from '$lib/stores/Author';
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

	mutedPubkeysByKindMap.set(new Map(prepared.muteState.mutedPubkeysByKind));
	applyAccountChannels(prepared.accountState);
}
