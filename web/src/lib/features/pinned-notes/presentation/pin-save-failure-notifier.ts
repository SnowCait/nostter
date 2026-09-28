import type { PinSaveFailure } from '../application/pinned-notes-runtime.svelte';

export function createPinSaveFailureNotifier(
	notify: () => void
): (failure: PinSaveFailure | undefined) => void {
	let lastNotifiedRevision: number | undefined;

	return (failure) => {
		if (failure === undefined || failure.revision === lastNotifiedRevision) {
			return;
		}
		lastNotifiedRevision = failure.revision;
		notify();
	};
}
