<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Spotify } from '$lib/Spotify';
	import ExternalLink from '../ExternalLink.svelte';

	interface Props {
		link: URL;
	}

	let { link }: Props = $props();

	let embedUrl = $derived(Spotify.getEmbedUrl(link));
</script>

{#if embedUrl !== undefined}
	<div class="spotify-embed-card">
		<iframe
			src={embedUrl.href}
			title=""
			frameborder="0"
			loading="lazy"
			aria-hidden="true"
			tabindex="-1"
		></iframe>

		<a
			class="spotify-embed-cover"
			href={link.href}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={$_('content.spotify.play')}
		>
			<span class="spotify-embed-label">{$_('content.spotify.play')}</span>
		</a>
	</div>
{:else}
	<ExternalLink {link} />
{/if}

<style>
	.spotify-embed-card {
		position: relative;
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
		transition:
			filter 0.18s ease,
			transform 0.18s ease;
	}

	.spotify-embed-cover {
		position: absolute;
		inset: 0;
		z-index: 10;
		display: grid;
		place-items: center;
		border-radius: 12px;
		text-decoration: none;
		cursor: pointer;
	}

	.spotify-embed-cover::before {
		content: '';
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0);
		transition: background 0.18s ease;
	}

	.spotify-embed-label {
		position: relative;
		z-index: 1;
		opacity: 0;
		transform: translateY(4px);
		padding: 10px 16px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.78);
		color: white;
		font-size: 15px;
		font-weight: 700;
		letter-spacing: 0.02em;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
		transition:
			opacity 0.18s ease,
			transform 0.18s ease;
	}

	.spotify-embed-card:hover iframe,
	.spotify-embed-card:focus-within iframe {
		filter: blur(3px) brightness(0.65);
		transform: scale(1.01);
	}

	.spotify-embed-card:hover .spotify-embed-cover::before,
	.spotify-embed-card:focus-within .spotify-embed-cover::before {
		background: rgba(0, 0, 0, 0.18);
	}

	.spotify-embed-card:hover .spotify-embed-label,
	.spotify-embed-card:focus-within .spotify-embed-label {
		opacity: 1;
		transform: translateY(0);
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

	@media (prefers-reduced-motion: reduce) {
		.spotify-embed-card iframe,
		.spotify-embed-cover::before,
		.spotify-embed-label {
			transition: none;
		}

		.spotify-embed-card:hover iframe,
		.spotify-embed-card:focus-within iframe {
			transform: none;
		}
	}
</style>
