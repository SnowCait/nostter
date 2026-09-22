<script lang="ts">
	import { _ } from 'svelte-i18n';
	import IconTrash from '@tabler/icons-svelte-runes/icons/trash';
	import { mute, unmute, type MuteCapabilities } from '$lib/author/Mute';
	import { muteWords } from '$lib/stores/Author';

	interface Props {
		getMuteCapabilities: () => MuteCapabilities;
	}

	let { getMuteCapabilities }: Props = $props();

	let word = $state('');

	async function onMute(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		console.log('[mute word]', word);

		try {
			const capabilities = getMuteCapabilities();
			await mute(capabilities, 'word', word);
			word = '';
		} catch (error) {
			console.error('[mute failed]', error);
			alert('Failed to mute.');
		}
	}

	async function onUnmute(word: string): Promise<void> {
		console.log('[unmute word]', word);

		try {
			const capabilities = getMuteCapabilities();
			await unmute(capabilities, 'word', word);
		} catch (error) {
			console.error('[unmute failed]', error);
			alert('Failed to unmute.');
		}
	}
</script>

<ul>
	{#each $muteWords as word}
		<li>
			<span>{word}</span>
			<button class="clear" onclick={() => onUnmute(word)}><IconTrash size={18} /></button>
		</li>
	{:else}
		<li>{$_('preferences.mute.none')}</li>
	{/each}
</ul>

<form onsubmit={onMute}>
	<input type="text" required bind:value={word} />
	<input type="submit" value="Mute" />
</form>

<style>
	button {
		color: var(--accent-gray);
	}
</style>
