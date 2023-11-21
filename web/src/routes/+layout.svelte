<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head>
	<meta name="description" content="Nostr client for web." />
	<meta property="og:image" content={`${$page.url.origin}/icon.png`} />
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
	</script>
	<script async src="https://www.googletagmanager.com/gtag/js?id=G-G1WMSV0PBP"></script>
</svelte:head>

<slot />
