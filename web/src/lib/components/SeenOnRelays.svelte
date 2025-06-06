<script lang="ts">
	import { seenOn } from '$lib/timelines/MainTimeline';

	export let id: string;

	$: relays = seenOn.get(id) ?? new Set<string>();
</script>

<h5>Seen on {relays.size} relays</h5>

{#each [...relays] as relay}
	<div>{relay}</div>
{/each}
