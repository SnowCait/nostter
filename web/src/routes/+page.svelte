<script lang="ts">
	import { goto } from '$app/navigation';
	import type { LayoutData } from './$types';
	import Notice from '$lib/components/Notice.svelte';
	import SplashScreen from './SplashScreen.svelte';
	import Login from './(app)/Login.svelte';
	import '../app.css';

	export let data: LayoutData;

	$: if (data.authenticated) {
		goto('/home');
	}
</script>

<Notice />

{#if data.splash}
	<SplashScreen />
{:else}
	<Login />
{/if}
