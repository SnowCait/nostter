<script lang="ts">
	import { Spotify } from '$lib/Spotify';
	import ExternalLink from '../ExternalLink.svelte';

	interface Props {
		link: URL;
	}

	let { link }: Props = $props();

	let embedUrl = $derived(Spotify.getEmbedUrl(link));
</script>

{#if embedUrl !== undefined}
	<iframe
		src={embedUrl.href}
		title=""
		frameborder="0"
		allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
		loading="lazy"
	></iframe>
{:else}
	<ExternalLink {link} />
{/if}

<style>
	iframe {
		width: 100%;
		max-width: 100%;
		height: 352px;
		display: block;
		border: 0;
		border-radius: 12px;
	}
	@media (max-width: 600px) {
		iframe {
			height: 232px;
		}
	}
</style>
