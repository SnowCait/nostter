<script lang="ts">
	import { goto } from '$app/navigation';
	import type { LayoutData } from './$types';
	import { followees, pubkey } from '$lib/stores/Author';
	import Notice from '$lib/components/Notice.svelte';
	import SplashScreen from './SplashScreen.svelte';
	import Login from './(app)/Login.svelte';

	export let data: LayoutData;

	$: homeLink = $followees.filter((x) => x !== $pubkey).length > 0 ? '/home' : '/public';

	$: if (data.authenticated) {
		goto(homeLink);
	}
</script>

<Notice />

{#if data.splash}
	<SplashScreen />
{:else}
	<Login />
{/if}
