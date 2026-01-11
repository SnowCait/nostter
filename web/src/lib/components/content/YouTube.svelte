<script lang="ts">
	import { run } from 'svelte/legacy';

	import { page } from '$app/stores';
	import { enablePreview } from '$lib/stores/Preference';
	import ExternalLink from '../ExternalLink.svelte';

	interface Props {
		link: URL;
	}

	let { link }: Props = $props();

	let id: string | undefined = $state();
	let short = $state(false);

	run(() => {
		if (link.hostname === 'youtu.be') {
			id = link.pathname.replace('/', '');
		} else if (link.pathname.startsWith('/live/')) {
			id = link.pathname.replace('/live/', '');
		} else {
			const v = link.searchParams.get('v');
			if (v !== null) {
				id = v;
			} else if (link.pathname.includes('shorts')) {
				const match = link.pathname.match(/\/shorts\/(?<id>\w+)/);
				id = match?.groups?.id;
				short = true;
			}
		}
	});
</script>

{#if id !== undefined && $enablePreview}
	<iframe
		class:short
		id="ytplayer"
		src="https://www.youtube.com/embed/{id}?origin={$page.url.origin}"
		title=""
		frameborder="0"
		allow="fullscreen; picture-in-picture; web-share"
		referrerpolicy="strict-origin-when-cross-origin"
	></iframe>
{:else}
	<ExternalLink {link} />
{/if}

<style>
	iframe {
		width: 100%;
		aspect-ratio: 640 / 360;
	}

	iframe.short {
		height: 28rem;
		width: 22rem;
	}

	@media (max-width: 600px) {
		iframe.short {
			width: 100%;
			height: auto;
			aspect-ratio: 9 / 16;
		}
	}
</style>
