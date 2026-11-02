<script lang="ts">
	import type { Event } from 'nostr-tools';
	import { isImageResourceUrl } from '$lib/platform/browser/resource-url';
	import { isHttpUrl } from '$lib/url';

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
	let parsedUrl = $derived(url === undefined ? null : URL.parse(url));
	let image = $derived(
		parsedUrl !== null &&
			mimeType !== undefined &&
			/image\/(gif|jpg|jpeg|png|webp|bmp)/.test(mimeType) &&
			isImageResourceUrl(parsedUrl)
	);
	let link = $derived(parsedUrl !== null && isHttpUrl(parsedUrl));
</script>

{#if parsedUrl !== null && image && link}
	<a href={parsedUrl.href} target="_blank" rel="noopener noreferrer">
		<img src={parsedUrl.href} alt={event.content} loading="lazy" decoding="async" />
	</a>
{:else if parsedUrl !== null && image}
	<img src={parsedUrl.href} alt={event.content} loading="lazy" decoding="async" />
{:else if parsedUrl !== null && link}
	<a href={parsedUrl.href} target="_blank" rel="noopener noreferrer">{url}</a>
{:else if url !== undefined}
	{url}
{/if}

<style>
	img {
		font-size: calc(1em / var(--applied-content-font-scale, 1));
		max-width: 100%;
		max-height: 20em;
		margin: 0.5em;
	}
</style>
