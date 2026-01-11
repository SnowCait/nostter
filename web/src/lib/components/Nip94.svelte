<script lang="ts">
	import type { Event } from 'nostr-tools';

	interface Props {
		event: Event;
	}

	let { event }: Props = $props();

	const url = event.tags
		.find(([tagName, tagContent]) => tagName === 'url' && tagContent !== undefined)
		?.at(1);
	const mimeType = event.tags
		.find(([tagName, tagContent]) => tagName === 'm' && tagContent !== undefined)
		?.at(1);
</script>

{#if mimeType !== undefined && /image\/(gif|jpg|jpeg|png|webp|bmp)/.test(mimeType)}
	<a href={url} target="_blank" rel="noopener noreferrer">
		<img src={url} alt={event.content} />
	</a>
{:else}
	<a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
{/if}

<style>
	img {
		max-width: 100%;
		max-height: 20em;
		margin: 0.5em;
	}
</style>
