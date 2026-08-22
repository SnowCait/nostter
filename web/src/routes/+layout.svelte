<script lang="ts">
	import { page } from '$app/state';
	import { appName } from '$lib/Constants';
	import '../app.css';
	import Toaster from '$lib/components/Toaster.svelte';
	import LoginStatus from '$lib/components/LoginStatus.svelte';
	import { onMount } from 'svelte';
	import { tryLogin } from '$lib/Login';
	import { updateThemeColor } from '$lib/Theme';
	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	onMount(() => {
		updateThemeColor();
		void tryLogin();
	});
</script>

<svelte:head>
	<title>{page.data.title}</title>
	<meta name="description" content={page.data.description} />
	<meta property="og:title" content={page.data.title} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content={page.data.image} />
	<meta property="og:url" content={page.url.href} />
	<meta property="og:description" content={page.data.description} />
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
	<script async src="https://www.googletagmanager.com/gtag/js?id=G-G1WMSV0PBP"></script>
</svelte:head>

<Toaster />
<LoginStatus />
{@render children?.()}
