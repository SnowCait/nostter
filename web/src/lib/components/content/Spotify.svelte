<script lang="ts">
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { _ } from 'svelte-i18n';
	import { Spotify } from '$lib/Spotify';
	import ExternalLink from '../ExternalLink.svelte';

	interface Props {
		link: URL;
	}

	let { link }: Props = $props();

	const directInteractionMediaQuery = new MediaQuery('(hover: hover) and (pointer: fine)', false);
	let mounted = $state(false);
	let supportsDirectInteraction = $derived(mounted && directInteractionMediaQuery.current);
	let embedUrl = $derived(Spotify.getEmbedUrl(link));

	onMount(() => {
		mounted = true;
	});
</script>

{#if embedUrl !== undefined}
	<div class="spotify-embed-card">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (The embedded Spotify player is interactive) -->
		<iframe
			src={embedUrl.href}
			title={$_('content.spotify.player')}
			frameborder="0"
			loading="lazy"
			aria-hidden={supportsDirectInteraction ? undefined : 'true'}
			tabindex={supportsDirectInteraction ? 0 : -1}
		></iframe>

		{#if !supportsDirectInteraction}
			<a
				class="spotify-embed-cover"
				href={link.href}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={$_('content.spotify.play')}
			></a>
		{/if}
	</div>
{:else}
	<ExternalLink {link} />
{/if}

<style>
	.spotify-embed-card {
		position: relative;
		isolation: isolate;
		width: 100%;
		max-width: 100%;
		border-radius: 12px;
		overflow: hidden;
		background: #000;
	}

	.spotify-embed-card iframe {
		display: block;
		width: 100%;
		height: 352px;
		border: 0;
		border-radius: 12px;
	}

	.spotify-embed-cover {
		position: absolute;
		inset: 0;
		z-index: 10;
		border-radius: 12px;
		text-decoration: none;
		cursor: pointer;
	}

	.spotify-embed-cover:focus-visible {
		outline: 3px solid #1db954;
		outline-offset: -3px;
	}

	@media (max-width: 600px) {
		.spotify-embed-card iframe {
			height: 232px;
		}
	}
</style>
