<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { toast } from '$lib/components/toast';
	import { pinnedNotes } from '../application/pinned-notes-runtime.svelte';

	onMount(() =>
		pinnedNotes.onSaveFailure(() => {
			toast.add({
				title: $_('pinned-notes.save-failed.title'),
				description: $_('pinned-notes.save-failed.description')
			});
		})
	);
</script>
