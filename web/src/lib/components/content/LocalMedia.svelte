<script lang="ts">
	import type { LocalMediaPreview } from '$lib/media/LocalAttachment';
	import Img from './Img.svelte';
	import Video from './Video.svelte';

	interface Props {
		media: LocalMediaPreview;
	}

	let { media }: Props = $props();
	let url = $derived(new URL(media.url));
</script>

{#if media.kind === 'image'}
	<Img {url} />
{:else if media.kind === 'video'}
	<Video {url} />
{:else}
	<audio src={media.url} controls></audio>
{/if}
