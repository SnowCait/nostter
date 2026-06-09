<script lang="ts" module>
	import { SvelteMap } from 'svelte/reactivity';
	import type { Ogp } from '$lib/ogp';

	const cache = new SvelteMap<string, Ogp | undefined>();
</script>

<script lang="ts">
	import { fetchOgp } from '$lib/ogp';

	interface Props {
		url: URL;
	}

	let { url }: Props = $props();

	function error(event: Event): void {
		const img = event.target as HTMLImageElement;
		img.hidden = true;
	}

	function resolveImage(image: string, base: URL): URL | undefined {
		try {
			return new URL(image, base);
		} catch {
			return undefined;
		}
	}

	let data = $derived(cache.get(url.href));

	$effect(() => {
		if (cache.has(url.href)) {
			return;
		}
		cache.set(url.href, undefined);
		fetchOgp(url).then((ogp) => cache.set(url.href, ogp));
	});
</script>

{#if data?.title}
	<a href={url.href} target="_blank" rel="noopener noreferrer">
		<blockquote>
			{#if data.image}
				{@const image = resolveImage(data.image, url)}
				{#if image?.protocol === 'https:'}
					<img src={image.href} alt="" onerror={error} loading="lazy" />
				{:else if image?.protocol === 'http:'}
					<!-- Don't show image due to mixed content -->
				{/if}
			{/if}
			<h1>{data.title}</h1>
			<div>{url.hostname}</div>
		</blockquote>
	</a>
{/if}

<style>
	a[target='_blank'] {
		text-decoration: none;
	}

	img {
		width: 100%;
		max-height: 260px;
		object-fit: cover;
	}

	h1 {
		padding: 0.5rem 0.8rem;
		font-size: 1.2rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	div {
		padding: 0 0.8rem 0.5rem 0.8rem;
		color: var(--accent-gray);
	}
</style>
