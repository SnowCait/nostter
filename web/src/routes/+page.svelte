<script lang="ts">
	import { goto } from '$app/navigation';
	import type { LayoutData } from './$types';
	import Login from './(app)/Login.svelte';
	import '../app.css';

	export let data: LayoutData;

	$: if (data.authenticated) {
		goto('/home');
	}
</script>

<svelte:head>
	<title>nostter</title>
</svelte:head>

{#if data.splash}
	<main>
		<img src="/nostter-logo.svg" alt="nostter" />
	</main>
{:else}
	<Login />
{/if}

<style>
	:global(html, body) {
		height: 100%;
	}

	main {
		height: 100%;
		display: flex;
		justify-content: center;
	}

	img {
		width: 100%;
		max-width: 360px;
	}
</style>
