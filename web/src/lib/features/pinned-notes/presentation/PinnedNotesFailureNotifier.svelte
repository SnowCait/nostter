<script lang="ts">
	import { untrack } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { addToast } from '$lib/components/Toaster.svelte';
	import { pinnedNotes } from '../application/pinned-notes-runtime.svelte';
	import { createPinSaveFailureNotifier } from './pin-save-failure-notifier';

	const notifyFailure = createPinSaveFailureNotifier(() =>
		addToast({
			data: {
				title: $_('pinned-notes.save-failed.title'),
				description: $_('pinned-notes.save-failed.description')
			}
		})
	);

	$effect(() => {
		const failure = pinnedNotes.failure;
		untrack(() => notifyFailure(failure));
	});
</script>
