<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { intentContent, openNoteDialog } from '../../../stores/NoteDialog';
	import { goto } from '$app/navigation';

	onMount(async () => {
		const content = $page.url.searchParams.get('content');
		if (content !== null) {
			$intentContent = content;
			$openNoteDialog = true;
		}

		await goto('/');
	});
</script>
