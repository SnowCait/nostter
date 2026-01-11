<script lang="ts">
	import { seenOn } from '$lib/timelines/MainTimeline';

	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	let relays = $derived(seenOn.get(id) ?? new Set<string>());
</script>

<h5>Seen on {relays.size} relays</h5>

{#each [...relays] as relay}
	<div>{relay}</div>
{/each}
