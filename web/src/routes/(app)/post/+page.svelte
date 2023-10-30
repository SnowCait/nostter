<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { intentContent } from '../../../stores/NoteDialog';
	import NoteEditor from '../editor/NoteEditor.svelte';

	const content = $page.url.searchParams.get('content');
	if (content !== null) {
		$intentContent = content;
	}

	async function afterPost(): Promise<void> {
		await goto('/home');
	}
</script>

<article class="card">
	<NoteEditor {afterPost} />
</article>
