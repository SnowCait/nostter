<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { appName } from '$lib/Constants';
	import { intentContent } from '../../../stores/NoteDialog';
	import NoteEditor from '../editor/NoteEditor.svelte';

	const content = $page.url.searchParams.get('content');
	if (content !== null) {
		$intentContent = content;
	}

	let editor: NoteEditor | undefined;

	async function afterPost(): Promise<void> {
		editor?.clear();
		await goto('/home');
	}
</script>

<svelte:head>
	<title>{appName} - {$_('post')}</title>
</svelte:head>

<article class="card">
	<NoteEditor bind:this={editor} {afterPost} />
</article>
