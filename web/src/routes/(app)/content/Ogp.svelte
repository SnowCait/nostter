<script lang="ts" context="module">
	const cache = new Map<string, any>();
</script>

<script lang="ts">
	import { corsAllowedHosts } from '$lib/Constants';

	export let url: URL;

	$: ogp = cache.get(url.href);

	$: if (!cache.has(url.href)) {
		const proxyUrl = corsAllowedHosts.includes(url.hostname)
			? url
			: `https://corsproxy.io/?${encodeURIComponent(url.href)}`;
		fetch(proxyUrl)
			.then(async (response) => {
				if (
					!response.ok ||
					response.status < 200 ||
					300 <= response.status ||
					!response.headers.get('Content-Type')?.includes('text/html')
				) {
					return;
				}
				const html = await response.text();
				const domParser = new DOMParser();
				const dom = domParser.parseFromString(html, 'text/html');
				ogp = Object.fromEntries(
					[...dom.head.children]
						.filter(
							(element) =>
								element.tagName === 'META' &&
								element.getAttribute('property')?.startsWith('og:')
						)
						.map((element) => {
							return [
								element.getAttribute('property'),
								element.getAttribute('content')
							];
						})
				);
				console.debug('[OGP]', url.href, ogp);
				cache.set(url.href, ogp);
			})
			.catch((error) => {
				console.info('[OGP error]', error);
			});
	}
</script>

{#if ogp !== undefined && ogp['og:title'] !== undefined}
	<a href={url.href} target="_blank" rel="noopener noreferrer">
		<blockquote>
			{#if ogp['og:image'] !== undefined}
				<img src={ogp['og:image']} alt={url.href} />
			{/if}
			<h1>{ogp['og:title']}</h1>
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
