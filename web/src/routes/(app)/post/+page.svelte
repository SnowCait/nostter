<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { appName } from '$lib/Constants';
	import { intentContent } from '../../../stores/NoteDialog';
	import NoteEditor from '$lib/components/editor/NoteEditor.svelte';

	const content = $page.url.searchParams.get('content');

	// Web Share Target API
	const title = $page.url.searchParams.get('title');
	const text = $page.url.searchParams.get('text');
	const url = $page.url.searchParams.get('url');
	const sharedContent = [title ?? text, url].filter((param) => param !== null).join('\n');

	if (content !== null) {
		$intentContent = content;
	} else {
		$intentContent = sharedContent;
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
