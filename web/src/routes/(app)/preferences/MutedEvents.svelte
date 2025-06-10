<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import { unmute } from '$lib/author/Mute';
	import { muteEventIds } from '$lib/stores/Author';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';

	let unmuting = false;

	async function onUnmute(eventId: string) {
		console.log('[unmute event]', eventId);

		unmuting = true;

		try {
			await unmute('e', eventId);
		} catch (error) {
			console.error('[unmute failed]', error);
			alert('Failed to unmute.');
		}

		unmuting = false;
	}
</script>

<ul>
	{#each $muteEventIds as eventId}
		{@const nevent = nip19.neventEncode({ id: eventId, relays: getSeenOnRelays(eventId) })}
		<li>
			<a href="/{nevent}">
				<span>{nevent.slice(0, 'nevent1'.length + 7)}</span>
			</a>
			<button class="clear" disabled={unmuting} on:click={() => onUnmute(eventId)}>
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
