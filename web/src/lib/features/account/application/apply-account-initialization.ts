import { mute } from '$lib/features/mute/application/mute-state.svelte';
import { applyAccountChannels, applyAccountState } from './apply-account-state';
import type { PreparedAccountInitialization } from './initialize-account';

export function applyAccountInitialization(
	pubkey: string,
	prepared: PreparedAccountInitialization
): void {
	applyAccountState(pubkey, prepared.accountState);

	mute.applySnapshot(pubkey, prepared.muteState.snapshot, prepared.muteState.baseline);
	applyAccountChannels(prepared.accountState);
}
