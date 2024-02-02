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
		.map(([, packets]) => packets)
		.toSorted((x, y) => x[0].event.kind - y[0].event.kind) as packets}
		<pre>{packets.map((packet) => packet.from).join('\n')}</pre>
		<Json object={packets[0].event} />
	{:else}
		<div>Fetching...</div>
	{/each}
{/if}

<style>
	button {
		color: var(--accent-gray);
	}
</style>
