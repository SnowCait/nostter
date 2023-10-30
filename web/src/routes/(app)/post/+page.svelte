<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { intentContent } from '../../../stores/NoteDialog';
	import NoteEditor from '../editor/NoteEditor.svelte';

	onMount(async () => {
		const content = $page.url.searchParams.get('content');
		if (content !== null) {
			$intentContent = content;
		}
	});
</script>

<article class="card">
	<NoteEditor />
</article>
