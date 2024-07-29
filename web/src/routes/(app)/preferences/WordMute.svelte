<script lang="ts">
	import { _ } from 'svelte-i18n';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import { mute, unmute } from '$lib/author/Mute';
	import { muteWords } from '$lib/stores/Author';

	let word = '';

	async function onMute(): Promise<void> {
		console.log('[mute word]', word);

		try {
			await mute('word', word);
			word = '';
		} catch (error) {
			alert('Failed to mute.');
		}
	}

	async function onUnmute(word: string): Promise<void> {
		console.log('[unmute word]', word);

		try {
			await unmute('word', word);
		} catch (error) {
			alert('Failed to unmute.');
		}
	}
</script>

<ul>
	{#each $muteWords as word}
		<li>
			<span>{word}</span>
			<button class="clear" on:click={() => onUnmute(word)}><IconTrash size={18} /></button>
		</li>
	{:else}
		<li>{$_('preferences.mute.none')}</li>
	{/each}
</ul>

<form on:submit|preventDefault={onMute}>
	<input type="text" required bind:value={word} on:keyup|stopPropagation={console.debug} />
	<input type="submit" value="Mute" />
</form>

<style>
	button {
		color: var(--accent-gray);
	}
</style>
