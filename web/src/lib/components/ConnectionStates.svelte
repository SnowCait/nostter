<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { connectionStates } from '$lib/timelines/MainTimeline';
	import { getDefaultReadRelays } from '$lib/RxNostrHelper';
	import type { ConnectionState } from 'rx-nostr';

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

	const relays = $derived.by(() => {
		const readRelays = new Set(getDefaultReadRelays());
		const states = [...$connectionStates].map(([relay, state]) => ({
			url: new URL(relay).href,
			state
		}));
		return {
			subscribed: states.filter(({ url }) => readRelays.has(url)),
			others: states.filter(({ url }) => !readRelays.has(url))
		};
	});
</script>

{#snippet relay({ url, state }: { url: string; state: ConnectionState })}
	<li class={connectionStatesGroup[state]} title={state}>
		{url}
	</li>
{/snippet}

<ul>
	{#each relays.subscribed as connection}
		{@render relay(connection)}
	{/each}
</ul>

{#if relays.others.length > 0}
	<details>
		<summary class="disclosure-summary">
			{$_('relay.connection.other_relays', { values: { count: relays.others.length } })}
		</summary>
		<ul>
			{#each relays.others as connection}
				{@render relay(connection)}
			{/each}
		</ul>
	</details>
{/if}

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
