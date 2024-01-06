<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Mute } from '$lib/Mute';
	import IconTrash from '@tabler/icons-svelte/dist/svelte/icons/IconTrash.svelte';
	import { muteWords } from '../../../stores/Author';

	let word = '';

	async function mute() {
		console.log('[mute word]', word);

		try {
			await new Mute().mutePrivate('word', word);
			word = '';
		} catch (error) {
			alert('Failed to mute.');
		}
	}

	async function unmute(word: string) {
		console.log('[unmute word]', word);

		try {
			await new Mute().unmutePrivate('word', word);
		} catch (error) {
			alert('Failed to unmute.');
		}
	}
</script>

<ul>
	{#each $muteWords as word}
		<li>
			<span>{word}</span>
			<button class="clear" on:click={() => unmute(word)}><IconTrash size={18} /></button>
		</li>
	{:else}
		<li>{$_('preferences.mute.none')}</li>
	{/each}
</ul>

<form on:submit|preventDefault={mute}>
	<input type="text" required bind:value={word} on:keyup|stopPropagation={console.debug} />
	<input type="submit" value="Mute" />
</form>

<style>
	button {
		color: var(--accent-gray);
	}
</style>
