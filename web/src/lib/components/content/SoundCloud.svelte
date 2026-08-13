<script lang="ts">
	import { SoundCloud, type SoundCloudEmbed } from '$lib/SoundCloud';
	import ExternalLink from '../ExternalLink.svelte';

	interface Props {
		link: URL;
	}

	let { link }: Props = $props();
	let embed: SoundCloudEmbed | undefined = $state();

	$effect(() => {
		let cancelled = false;
		const controller = new AbortController();
		embed = undefined;
		void SoundCloud.fetchEmbed(link, controller.signal).then((result) => {
			if (!cancelled) {
				embed = result;
			}
		});
		return () => {
			cancelled = true;
			controller.abort();
		};
	});
</script>

{#if embed !== undefined}
	<iframe
		src={embed.src.href}
		title={embed.title}
		frameborder="0"
		allow="autoplay"
		loading="lazy"
		referrerpolicy="strict-origin-when-cross-origin"
		style:height={`${embed.height}px`}
	></iframe>
{:else}
	<ExternalLink {link} />
{/if}

<style>
	iframe {
		display: block;
		width: 100%;
		max-width: 100%;
		border: 0;
	}
</style>
