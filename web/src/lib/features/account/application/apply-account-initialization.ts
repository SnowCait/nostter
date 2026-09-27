import { applyKindMuteInitialization } from '$lib/features/mute/application/kind-mute-runtime.svelte';
import { applyRegularMuteInitialization } from '$lib/features/mute/application/regular-mute-runtime.svelte';
import { applyAccountChannels, applyAccountState } from './apply-account-state';
import type { PreparedAccountInitialization } from './initialize-account';

export function applyAccountInitialization(
	pubkey: string,
	prepared: PreparedAccountInitialization
): void {
	applyAccountState(pubkey, prepared.accountState);

	applyRegularMuteInitialization(pubkey, prepared.muteState.mute, prepared.muteState.baseline);

	applyKindMuteInitialization(pubkey, prepared.muteState.mutedPubkeysByKind);
	applyAccountChannels(prepared.accountState);
}
