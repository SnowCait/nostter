<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import { unmute } from '$lib/author/Mute';
	import { mutePubkeys } from '$lib/stores/Author';
	import { metadataReqEmit } from '$lib/timelines/MainTimeline';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import OnelineProfile from '$lib/components/profile/OnelineProfile.svelte';

	let unmuting = false;

	onMount(async () => {
		metadataReqEmit($mutePubkeys);
	});

	async function onUnmute(pubkey: string): Promise<void> {
		console.log('[unmute pubkey]', pubkey);

		unmuting = true;

		try {
			await unmute('p', pubkey);
		} catch (error) {
			console.error('[unmute failed]', error);
			alert('Failed to unmute.');
		}

		unmuting = false;
	}
</script>

<ul>
	{#each $mutePubkeys as pubkey}
		<li>
			<a href="/{nip19.npubEncode(pubkey)}">
				<OnelineProfile {pubkey} />
			</a>
			<button class="clear" disabled={unmuting} on:click={() => onUnmute(pubkey)}>
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
