<script lang="ts">
	import { activeAt } from '$lib/timelines/HomeTimeline';
	import { rxNostr } from '$lib/timelines/MainTimeline';

	let states = rxNostr.getAllRelayStatus();

	function refresh() {
		states = rxNostr.getAllRelayStatus();
	}
</script>

<section class="card">
	<h3>Relay states</h3>
	<button on:click={refresh}>Refresh</button>
	<code>{JSON.stringify(states, null, 2)}</code>
	<div>Active at {new Date($activeAt * 1000).toLocaleString()}</div>
</section>

<style>
	button {
		margin: 1rem auto;
	}
</style>
