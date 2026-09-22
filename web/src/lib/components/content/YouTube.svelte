<script lang="ts">
	import { page } from '$app/state';
	import { getYouTubeEmbed } from '$lib/embeds/youtube';
	import { enablePreview } from '$lib/stores/Preference';
	import ExternalLink from '../ExternalLink.svelte';

	interface Props {
		link: URL;
	}

	let { link }: Props = $props();
	let embed = $derived(getYouTubeEmbed(link, page.url.origin));
</script>

{#if embed !== undefined && $enablePreview}
	<iframe
		class:short={embed.short}
		id="ytplayer"
		src={embed.src.href}
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
