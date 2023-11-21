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

	async function afterPost(): Promise<void> {
		await goto('/home');
	}
</script>

<svelte:head>
	<title>{appName} - {$_('post')}</title>
</svelte:head>

<article class="card">
	<NoteEditor {afterPost} />
</article>
