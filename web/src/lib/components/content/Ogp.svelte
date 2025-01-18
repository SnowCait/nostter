<script lang="ts" context="module">
	const cache = new Map<string, any>();
</script>

<script lang="ts">
	export let url: URL;

	$: ogp = cache.get(url.href);

	$: if (!cache.has(url.href)) {
		fetchOgp(url, true).then((success) => {
			if (!success) {
				fetchOgp(url, false);
			}
		});
	}

	async function fetchOgp(url: URL, proxy: boolean): Promise<boolean> {
		console.debug('[OGP url]', url.href, proxy);
		cache.set(url.href, undefined);

		return await new Promise((resolve) => {
			fetch(proxy ? `https://proxy.nostter.app/?url=${encodeURIComponent(url.href)}` : url)
				.then(async (response) => {
					const contentType = response.headers.get('Content-Type');
					if (
						!response.ok ||
						response.status < 200 ||
						300 <= response.status ||
						contentType === null ||
						!contentType.includes('text/html')
					) {
						console.debug(
							'[OGP error]',
							url.href,
							response.ok,
							response.status,
							...response.headers
						);
						resolve(false);
						return;
					}
					const html = await response.text();
					const domParser = new DOMParser();
					const dom = domParser.parseFromString(html, 'text/html');
					const metaTags = [...dom.head.children].filter(
						(element) => element.tagName === 'META'
					);
					if (
						!/charset=utf-8/i.test(contentType) &&
						!metaTags.some(
							(element) => element.getAttribute('charset')?.toLowerCase() === 'utf-8'
						)
					) {
						console.debug(
							'[OGP charset is not utf-8]',
							url.href,
							metaTags.find((element) => element.getAttribute('charset') !== null)
						);
						resolve(true);
						return;
					}
					ogp = Object.fromEntries(
						metaTags
							.filter((element) =>
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
					resolve(true);
				})
				.catch((error) => {
					console.info('[OGP network/CORS error]', url.href, error);
					resolve(false);
				});
		});
	}
</script>

{#if ogp !== undefined && ogp['og:title']}
	<a href={url.href} target="_blank" rel="noopener noreferrer">
		<blockquote>
			{#if ogp['og:image']}
				{#if ogp['og:image'].startsWith('https://')}
					<img src={ogp['og:image']} alt={url.href} />
				{:else}
					<img src={new URL(url.href).origin + ogp['og:image']} alt={url.href} />
				{/if}
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
