<script lang="ts">
	import { connectionStates } from '$lib/timelines/MainTimeline';
	import type { ConnectionState } from 'rx-nostr';

	export let relays: string[] | undefined = undefined;

	const connectionStatesGroup = {
		initialized: 'pending',
		connecting: 'pending',
		connected: 'success',
		'waiting-for-retrying': 'pending',
		retrying: 'pending',
		dormant: 'pending',
		error: 'error',
		rejected: 'error',
		terminated: 'error'
	} satisfies { [key in ConnectionState]: 'pending' | 'success' | 'error' };
</script>

<ul>
	{#each $connectionStates as [relay, state]}
		{#if relays === undefined || relays.includes(new URL(relay).href)}
			<li class={connectionStatesGroup[state]} title={state}>
				{new URL(relay).href}
			</li>
		{/if}
	{/each}
</ul>

<style>
	ul {
		margin-left: 2rem;
	}

	ul li.pending::marker {
		color: orange;
	}

	ul li.success::marker {
		color: green;
	}

	ul li.error::marker {
		color: red;
	}
</style>
