<script lang="ts">
	import type { Relay } from 'nostr-tools';
	import { pool } from '../stores/Pool';
	import { readRelays } from '../stores/Author';
	import { debugMode } from '../stores/Preference';
	import ModalDialog from '$lib/components/ModalDialog.svelte';

	let open = false;
	let relays: Relay[] = [];

	export function tryOpen() {
		console.debug('_conn', $pool['_conn']);
		relays = Object.entries($pool['_conn'] as { [url: string]: Relay })
			.filter(([url]) => $readRelays.includes(new URL(url).href))
			.map(([, relay]) => relay);
		if (
			relays.filter((relay) => relay.status === WebSocket.OPEN).length < relays.length / 2 ||
			$debugMode
		) {
			console.error(
				'[unstable connection]',
				relays.map((relay) => [relay.url, relay.status])
			);
			open = true;
		}
	}
</script>

<ModalDialog bind:open>
	<h1>Unstable connection</h1>
	<p>More than half relays are lost connection.</p>
	<button on:click={() => (location.href = location.href)}>Reload</button>
	<ul>
		{#each relays as relay}
			<li>{relay.url} {relay.status}</li>
		{/each}
	</ul>
</ModalDialog>

<style>
	li {
		word-break: break-all;
	}
</style>
