<script lang="ts">
	import type { Item } from '$lib/Items';
	import TimelineView from '../TimelineView.svelte';

	interface Props {
		authenticated: boolean;
		items: Item[];
		load: () => Promise<void>;
	}

	let { authenticated, items, load }: Props = $props();
</script>

{#if authenticated}
	<TimelineView {items} {load} />
{/if}
