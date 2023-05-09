<script lang="ts">
	import type { Relay } from 'nostr-tools';
	import { pool } from '../stores/Pool';
	import { readRelays } from '../stores/Author';

	let relays: Relay[] = [];

	export function tryOpen() {
		console.debug('_conn', $pool['_conn']);
		relays = Object.entries($pool['_conn'] as { [url: string]: Relay })
			.filter(([url]) => $readRelays.includes(new URL(url).href))
			.map(([, relay]) => relay);
		if (relays.filter((relay) => relay.status === WebSocket.OPEN).length < relays.length / 2) {
			console.error(
				'[unstable connection]',
				relays.map((relay) => [relay.url, relay.status])
			);
			dialog.showModal();
		}
	}

	let dialog: HTMLDialogElement;

	function close(e: MouseEvent) {
		const element = (e.target as Element).closest('.dialog-content');
		console.log('[close reload dialog]', element, dialog);
		if (element === null) {
			dialog.close();
		}
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<dialog bind:this={dialog} on:click={close}>
	<div class="dialog-content">
		<h1>Unstable connection</h1>
		<p>More than half relays are lost connection.</p>
		<button on:click={() => (location.href = '/')}>Reload</button>
		<ul>
			{#each relays as relay}
				<li>{relay.url} {relay.status}</li>
			{/each}
		</ul>
	</div>
</dialog>

<style>
	dialog {
		padding: 0;
		border: 1px;
		border-style: solid;
		border-color: lightgray;
		border-radius: 10px;
	}

	.dialog-content {
		padding: 1em;
	}

	li {
		word-break: break-all;
	}
</style>
