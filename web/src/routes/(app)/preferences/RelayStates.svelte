<script lang="ts">
	import { rxNostr } from '$lib/timelines/MainTimeline';

	let states = rxNostr.getAllRelayState();

	function refresh() {
		states = rxNostr.getAllRelayState();
	}
</script>

<section class="card">
	<h3>Relay states</h3>
	<button on:click={refresh}>Refresh</button>
	<code>{JSON.stringify(states, null, 2)}</code>
</section>

<style>
	button {
		margin: 1rem auto;
	}
</style>
