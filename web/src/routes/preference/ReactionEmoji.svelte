<script lang="ts">
	import { writable } from 'svelte/store';
	import { reactionEmoji } from '../../stores/Preference';
	import { pool } from '../../stores/Pool';
	import { writeRelays } from '../../stores/Author';
	import { onMount } from 'svelte';
	import { Signer } from '$lib/Signer';
	import type { Kind } from 'nostr-tools';

	let pawPad = writable($reactionEmoji === '🐾');

	onMount(async () => {
		pawPad.subscribe(async (value) => {
			const previousEmoji = $reactionEmoji;

			if (value) {
				$reactionEmoji = '🐾';
			} else {
				$reactionEmoji = '+';
			}

			if (previousEmoji === $reactionEmoji) {
				return;
			}

			// Save
			const event = await Signer.signEvent({
				created_at: Math.round(Date.now() / 1000),
				kind: 30078 as Kind,
				tags: [['d', 'nostter-reaction-emoji']],
				content: $reactionEmoji
			});
			console.log('[reaction emoji]', event);
			await $pool.publish($writeRelays, event);
		});
	});
</script>

<span>Reaction:</span>
<input id="paw-pad" type="checkbox" bind:checked={$pawPad} />
<label for="paw-pad">🐾</label>
