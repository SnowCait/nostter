<script lang="ts">
	import type { Event } from 'nostr-tools';
	import Img from './content/Img.svelte';

	interface Props {
		event: Event;
	}

	let { event }: Props = $props();

	let url = $derived(
		event.tags
			.find(([tagName, tagContent]) => tagName === 'url' && tagContent !== undefined)
			?.at(1)
	);
	let mimeType = $derived(
		event.tags
			.find(([tagName, tagContent]) => tagName === 'm' && tagContent !== undefined)
			?.at(1)
	);
</script>

{#if url !== undefined && URL.canParse(url) && mimeType !== undefined && /image\/(avif|gif|jpg|jpeg|png|webp|bmp|apng)/.test(mimeType)}
	<a href={url} target="_blank" rel="noopener noreferrer">
		<Img url={new URL(url)} {mimeType} />
	</a>
{:else if url !== undefined}
	<a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
{/if}
