<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import { Mute } from '$lib/Mute';
	import { muteEventIds } from '../../../stores/Author';
	import IconTrash from '@tabler/icons-svelte/dist/svelte/icons/IconTrash.svelte';

	let unmuting = false;

	const mute = new Mute();

	async function unmute(eventId: string) {
		console.log('[unmute event]', eventId);

		unmuting = true;

		try {
			await mute.unmutePrivate('e', eventId);
		} catch (error) {
			alert('Failed to unmute.');
		}

		unmuting = false;
	}
</script>

<ul>
	{#each $muteEventIds as eventId}
		<li>
			<a href="/{nip19.neventEncode({ id: eventId })}">
				<span>{nip19.neventEncode({ id: eventId }).slice(0, 'nevent1'.length + 7)}</span>
			</a>
			<button class="clear" disabled={unmuting} on:click={() => unmute(eventId)}>
				<IconTrash size={18} />
			</button>
		</li>
	{:else}
		<li>{$_('preferences.mute.none')}</li>
	{/each}
</ul>

<style>
	button {
		color: var(--accent-gray);
	}
</style>
