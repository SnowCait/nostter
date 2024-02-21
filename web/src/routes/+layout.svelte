<script lang="ts">
	import { SvelteUIProvider } from '@svelteuidev/core';
	import { page } from '$app/stores';
	import { appName } from '$lib/Constants';
	import '../app.css';

	const description = 'Nostr client for web.';
</script>

<svelte:head>
	<title>{appName}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={appName} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content={`${$page.url.origin}/icon.192.png`} />
	<meta property="og:url" content={$page.url.href} />
	<meta property="og:description" content={description} />
	<meta property="og:site_name" content={appName} />
	<meta name="twitter:card" content="summary" />
	<style>
		@media not (display-mode: standalone) {
			body {
				overscroll-behavior-y: none;
			}
		}

		@media screen and (max-width: 600px) {
			body {
				margin: 0;
			}
		}
	</style>
	<script>
		const theme = localStorage.getItem('nostter:theme') ?? 'system';
		console.log('[theme]', theme);
		if (
			theme === 'dark' ||
			(theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
		) {
			document.documentElement.classList.add('dark');
		}

		const color = getComputedStyle(document.documentElement).getPropertyValue('--background');
		let themeColorMetaTag = document.querySelector('meta[name="theme-color"]');
		themeColorMetaTag.content = color;
	</script>
	<script async src="https://www.googletagmanager.com/gtag/js?id=G-G1WMSV0PBP"></script>
</svelte:head>

<SvelteUIProvider>
	<slot />
</SvelteUIProvider>
