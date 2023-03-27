<script lang="ts" context="module">
	interface Window {
		// NIP-07
		nostr: any;
	}
	declare var window: Window;
</script>

<script lang="ts">
	import { writable } from 'svelte/store';
	import { reactionEmoji } from '../../stores/Preference';
	import { pool } from '../../stores/Pool';
	import { relayUrls } from '../../stores/Author';
	import { onMount } from 'svelte';

	let pawPad = writable($reactionEmoji === '🐾');

	onMount(async () => {
		pawPad.subscribe(async (value) => {
			if (value) {
				$reactionEmoji = '🐾';
			} else {
				$reactionEmoji = '+';
			}
		});
	});
</script>

<input id="paw-pad" type="checkbox" bind:checked={$pawPad} />
<label for="paw-pad">🐾</label>
