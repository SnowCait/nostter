<script lang="ts">
	import { replaceableEvents } from '$lib/Profile';
	import Json from './Json.svelte';
	import IconCodeDots from '@tabler/icons-svelte/icons/code-dots';

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
		.sort(([{ event: x }], [{ event: y }]) => {
			if (x.kind === y.kind) {
				return y.created_at - x.created_at;
			}
			return x.kind - y.kind;
		}) as packets}
		<pre>{packets.map((packet) => packet.from).join('\n')}</pre>
		<div>{new Date(packets[0].event.created_at * 1000).toLocaleString()}</div>
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
