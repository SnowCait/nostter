<script lang="ts">
	import { page } from '$app/stores';
	import { enablePreview } from '$lib/stores/Preference';
	import ExternalLink from '../ExternalLink.svelte';

	interface Props {
		link: URL;
	}

	let { link }: Props = $props();

	let video = $derived.by(() => {
		if (link.hostname === 'youtu.be') {
			return { id: link.pathname.replace('/', ''), short: false };
		}
		if (link.pathname.startsWith('/live/')) {
			return { id: link.pathname.replace('/live/', ''), short: false };
		}
		const v = link.searchParams.get('v');
		if (v !== null) {
			return { id: v, short: false };
		}
		if (link.pathname.includes('shorts')) {
			const match = link.pathname.match(/\/shorts\/(?<id>\w+)/);
			return { id: match?.groups?.id, short: true };
		}
		return { id: undefined, short: false };
	});
</script>

{#if video.id !== undefined && $enablePreview}
	<iframe
		class:short={video.short}
		id="ytplayer"
		src="https://www.youtube.com/embed/{video.id}?origin={$page.url.origin}"
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
		max-width: 100%;
		display: block;
		aspect-ratio: 640 / 360;
	}

	iframe.short {
		height: 28rem;
		width: min(22rem, 100%);
		margin: 0 auto;
	}

	@media (max-width: 600px) {
		iframe.short {
			width: 100%;
			height: auto;
			aspect-ratio: 9 / 16;
		}
	}
</style>
