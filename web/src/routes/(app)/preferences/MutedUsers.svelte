<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { nip19, type Event } from 'nostr-tools';
	import { Mute } from '$lib/Mute';
	import { Api } from '$lib/Api';
	import { Metadata } from '$lib/Items';
	import { mutePubkeys, writeRelays } from '$lib/stores/Author';
	import { pool } from '$lib/stores/Pool';
	import IconTrash from '@tabler/icons-svelte/dist/svelte/icons/IconTrash.svelte';

	let metadataEvents = new Map<string, Event>();
	let unmuting = false;

	const mute = new Mute();

	onMount(async () => {
		const api = new Api($pool, $writeRelays);
		metadataEvents = await api.fetchMetadataEventsMap($mutePubkeys);
	});

	async function unmute(pubkey: string) {
		console.log('[unmute pubkey]', pubkey);

		unmuting = true;

		try {
			await mute.unmutePrivate('p', pubkey);
		} catch (error) {
			alert('Failed to unmute.');
		}

		unmuting = false;
	}
</script>

<ul>
	{#each $mutePubkeys as pubkey}
		{@const metadataEvent = metadataEvents.get(pubkey)}
		{@const metadata = metadataEvent === undefined ? undefined : new Metadata(metadataEvent)}
		<li>
			<a href="/{nip19.npubEncode(pubkey)}">
				<img src={metadata?.content?.picture} alt="" title="" />
				<span>
					{metadata?.content?.name ??
						nip19.npubEncode(pubkey).slice(0, 'npub1'.length + 7)}
				</span>
			</a>
			<button class="clear" disabled={unmuting} on:click={() => unmute(pubkey)}>
				<IconTrash size={18} />
			</button>
		</li>
	{:else}
		<li>{$_('preferences.mute.none')}</li>
	{/each}
</ul>

<style>
	img {
		width: 20px;
		height: 20px;
	}

	button {
		color: var(--accent-gray);
	}
</style>
