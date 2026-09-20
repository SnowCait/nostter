<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { appName } from '$lib/app';
	import NoteComposer from '$lib/components/composer/NoteComposer.svelte';
	import { sharedContent } from '$lib/features/post/domain/shared-content';
	import { consumeSharedPost } from '$lib/platform/storage/shared-post';

	const contentParameter = page.url.searchParams.get('content');

	// Web Share Target API
	// Android has no dedicated url field, so the shared URL arrives in text (or title).
	const title = page.url.searchParams.get('title');
	const text = page.url.searchParams.get('text');
	const url = page.url.searchParams.get('url');
	let content = $state(contentParameter ?? sharedContent(title, text, url));

	let composer: NoteComposer | undefined = $state();

	onMount(async () => {
		const shareId = page.url.searchParams.get('share');
		if (shareId === null) return;
		try {
			const share = await consumeSharedPost(shareId);
			if (share === undefined) {
				console.warn('[share target] Shared post was unavailable', shareId);
				return;
			}
			if (contentParameter === null)
				content = sharedContent(share.title, share.text, share.url);
			await tick();
			composer?.addAttachments(share.files);
		} catch (error) {
			console.error('[share target] Could not load shared post', error);
		}
	});

	async function afterPost(): Promise<void> {
		composer?.clear();
		await goto('/home');
	}
</script>

<svelte:head>
	<title>{appName} - {$_('post')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="card">
	<NoteComposer bind:this={composer} bind:content {afterPost} />
</article>
