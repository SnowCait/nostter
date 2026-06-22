<script lang="ts">
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { hostname } from '$lib/Helper';
	import RelayIcon from './RelayIcon.svelte';

	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	let relays = $derived(getSeenOnRelays(id) ?? []);
</script>

<div class="relays">
	{#each relays as relay (relay)}
		<a href="/relays/{encodeURIComponent(relay)}" title={hostname(relay)}>
			<RelayIcon {relay} />
		</a>
	{/each}
</div>

<style>
	.relays {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}
</style>
