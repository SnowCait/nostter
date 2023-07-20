<script lang="ts">
	import { Mute } from '$lib/Mute';
	import IconTrash from '@tabler/icons-svelte/dist/svelte/icons/IconTrash.svelte';
	import { pubkey, muteWords, writeRelays } from '../../stores/Author';
	import { pool } from '../../stores/Pool';

	let word = '';

	async function mute() {
		console.log('[mute word]', word);

		try {
			await new Mute($pubkey, $pool, $writeRelays).muteWord(word);
			word = '';
		} catch (error) {
			alert('Failed to mute.');
		}
	}

	async function unmute(word: string) {
		console.log('[unmute word]', word);

		try {
			await new Mute($pubkey, $pool, $writeRelays).unmuteWord(word);
		} catch (error) {
			alert('Failed to unmute.');
		}
	}
</script>

<h4>Mute Words</h4>

<ul>
	{#each $muteWords as word}
		<li>
			<span>{word}</span>
			<button class="clear" on:click={() => unmute(word)}><IconTrash size={18} /></button>
		</li>
	{/each}
</ul>

<form on:submit|preventDefault={mute}>
	<input type="text" required bind:value={word} />
	<input type="submit" value="Mute" />
</form>
