<script lang="ts">
	import { replaceableEvents } from '$lib/Profile';
	import Json from './Json.svelte';
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';

	let showReplaceableEvents = false;

	function toggleReplaceableEvents() {
		showReplaceableEvents = !showReplaceableEvents;
	}
</script>

<button class="clear" on:click={toggleReplaceableEvents}>
	<IconCodeDots />
</button>
{#if showReplaceableEvents}
	{#each [...$replaceableEvents]
		.map(([, event]) => event)
		.toSorted((x, y) => x.kind - y.kind) as event}
		<Json object={event} />
	{:else}
		<div>Fetching...</div>
	{/each}
{/if}

<style>
	button {
		color: var(--accent-gray);
	}
</style>
