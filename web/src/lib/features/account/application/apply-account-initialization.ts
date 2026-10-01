import { applyKindMuteInitialization } from '$lib/features/mute/application/kind-mute-runtime.svelte';
import { applyRegularMuteInitialization } from '$lib/features/mute/application/regular-mute-runtime.svelte';
import { pinnedNotes } from '$lib/features/pinned-notes/application/pinned-notes-runtime.svelte';
import { markEventsDeleted } from '$lib/features/event-deletion/application/deletion-state';
import { applyAccountChannels, applyAccountState } from './apply-account-state';
import type { PreparedAccountInitialization } from './initialize-account';

export function applyAccountInitialization(
	pubkey: string,
	prepared: PreparedAccountInitialization
): void {
	for (const deletionRequest of prepared.deletionRequests) {
		markEventsDeleted(deletionRequest);
	}
	applyAccountState(pubkey, prepared.accountState);
	pinnedNotes.initialize(pubkey, prepared.accountState.pinnedNotesEvent);

	applyRegularMuteInitialization(pubkey, prepared.muteState.mute, prepared.muteState.baseline);

	applyKindMuteInitialization(pubkey, prepared.muteState.mutedPubkeysByKind);
	applyAccountChannels(prepared.accountState);
}
