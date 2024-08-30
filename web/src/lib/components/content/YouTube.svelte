<script lang="ts">
	import { page } from '$app/stores';
	import { enablePreview } from '$lib/stores/Preference';
	import ExternalLink from '../ExternalLink.svelte';

	export let link: URL;

	let id: string | undefined;

	$: {
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
			}
		}
	}
</script>

{#if id !== undefined && $enablePreview}
	<iframe
		id="ytplayer"
		src="https://www.youtube.com/embed/{id}?origin={$page.url.origin}"
		frameborder="0"
		title=""
	/>
{:else}
	<ExternalLink {link} />
{/if}

<style>
	iframe {
		width: 100%;
		aspect-ratio: 640 / 360;
	}
</style>
