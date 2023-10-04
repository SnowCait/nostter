<script lang="ts">
	import { author } from '../stores/Author';
	import Login from './Login.svelte';
</script>

<svelte:head>
	<title>nostter</title>
</svelte:head>

<main>
	<h1>nostter</h1>
	{#if $author === undefined}
		<Login />
	{/if}
</main>
