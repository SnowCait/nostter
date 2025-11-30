<script lang="ts">
	import ConnectionStates from '$lib/components/ConnectionStates.svelte';
	import { activeAt } from '$lib/timelines/HomeTimeline';
	import { _ } from 'svelte-i18n';
</script>

<section class="card">
	<h3>{$_('relay.connection.states')}</h3>
	<ConnectionStates />
	<div>Active at {new Date($activeAt * 1000).toLocaleString()}</div>
</section>
