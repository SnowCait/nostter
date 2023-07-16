<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import IconVolumeOff from '@tabler/icons-svelte/dist/svelte/icons/IconVolumeOff.svelte';
	import IconTrash from '@tabler/icons-svelte/dist/svelte/icons/IconTrash.svelte';
	import { pool } from '../../stores/Pool';
	import { pubkey as authorPubkey, mutePubkeys, writeRelays } from '../../stores/Author';
	import { Mute } from '$lib/Mute';

	export let pubkey: string;

	let executing = false;

	async function mute() {
		console.log('[mute]', nip19.npubEncode(pubkey));

		if (!confirm('Mute this user?')) {
			console.log('[mute cancelled]');
			return;
		}

		executing = true;

		try {
			await new Mute($authorPubkey, $pool, $writeRelays).mutePrivate('p', pubkey);
		} catch (error) {
			alert('Failed to mute.');
		}

		executing = false;
	}

	async function unmute() {
		console.log('[unmute]');

		if (!confirm(`Unmute this user?`)) {
			console.log('Unmute is cancelled');
			return;
		}

		executing = true;

		try {
			await new Mute($authorPubkey, $pool, $writeRelays).unmutePrivate('p', pubkey);
		} catch (error) {
			alert('Failed to unmute.');
		}

		executing = false;
	}
</script>

{#if $mutePubkeys.some((p) => p === pubkey)}
	<div class="muting">
		<span>Muting</span>
		<button on:click={unmute} disabled={executing}><IconTrash /></button>
	</div>
{:else if $authorPubkey !== ''}
	<button on:click={mute} disabled={executing}><IconVolumeOff /></button>
{/if}

<style>
	.muting {
		display: flex;
		flex-direction: row;
	}

	button {
		border: none;
		background-color: inherit;
		cursor: pointer;
		outline: none;
		padding: 0;
		color: gray;
		height: 20px;

		margin-left: 0.2em;
	}
</style>
