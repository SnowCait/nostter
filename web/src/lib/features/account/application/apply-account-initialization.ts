import {
	applyMuteTags,
	hasRegularMuteStateChangedForAccount,
	setMuteEventForAccount,
	mutedPubkeysByKindMap
} from '$lib/stores/Author';
import { applyAccountChannels, applyAccountState } from './apply-account-state';
import type { PreparedAccountInitialization } from './initialize-account';

export function applyAccountInitialization(
	pubkey: string,
	prepared: PreparedAccountInitialization
): void {
	applyAccountState(pubkey, prepared.accountState);

	if (!hasRegularMuteStateChangedForAccount(prepared.muteState.baselineVersion, pubkey)) {
		setMuteEventForAccount(prepared.muteState.mute.event, pubkey);
		applyMuteTags(prepared.muteState.mute.tags, pubkey);
	}

	mutedPubkeysByKindMap.set(new Map(prepared.muteState.mutedPubkeysByKind));
	applyAccountChannels(prepared.accountState);
}
