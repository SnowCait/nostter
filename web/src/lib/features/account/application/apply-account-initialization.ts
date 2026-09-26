import { get } from 'svelte/store';
import { applyMutedPubkeysByKind, mutedPubkeysByKindMap } from '$lib/stores/Author';
import { regularMute } from '$lib/features/mute/application/regular-mute-state.svelte';
import { applyAccountChannels, applyAccountState } from './apply-account-state';
import type { PreparedAccountInitialization } from './initialize-account';

export function applyAccountInitialization(
	pubkey: string,
	prepared: PreparedAccountInitialization
): void {
	applyAccountState(pubkey, prepared.accountState);

	regularMute.applySnapshot(pubkey, prepared.muteState.mute, prepared.muteState.baseline);

	applyMutedPubkeysByKind(
		new Map(
			[...prepared.muteState.mutedPubkeysByKind].map(([kind, { pubkeys }]) => [
				kind,
				new Set(pubkeys)
			])
		),
		get(mutedPubkeysByKindMap)
	);
	applyAccountChannels(prepared.accountState);
}
