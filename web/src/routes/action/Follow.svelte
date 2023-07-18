<script lang="ts">
	import IconTrash from '@tabler/icons-svelte/dist/svelte/icons/IconTrash.svelte';
	import { Api } from '$lib/Api';
	import { pool } from '../../stores/Pool';
	import { followees, pubkey as authorPubkey, writeRelays } from '../../stores/Author';
	import { nip19 } from 'nostr-tools';
	import { Contacts } from '$lib/Contacts';

	export let pubkey: string;

	let following = false;

	const api = new Api($pool, $writeRelays);

	async function follow() {
		console.log('[follow]');

		following = true;

		try {
			const contacts = new Contacts($authorPubkey, $pool, $writeRelays);
			await contacts.follow(pubkey);
			$followees.push(pubkey);
			$followees = $followees;
		} catch (error) {
			console.error('[follow failed]', error);
			alert('Failed to follow.');
		}

		following = false;
	}

	async function unfollow() {
		console.log('[unfollow]');

		const userEvent = await api.fetchUserEvent(pubkey);

		if (
			!confirm(
				`Unfollow @${
					userEvent?.user?.name ??
					nip19.npubEncode(pubkey).substring(0, 'npub1'.length + 7)
				}?`
			)
		) {
			console.log('Unfollow is cancelled');
			return;
		}

		try {
			const contacts = new Contacts($authorPubkey, $pool, $writeRelays);
			await contacts.unfollow(pubkey);
			$followees = $followees.filter((x) => x !== pubkey);
		} catch (error) {
			console.error('[unfollow failed]', error);
			alert('Failed to unfollow.');
		}
	}
</script>

{#if $followees.some((x) => x === pubkey)}
	<div class="following">
		<div>Following</div>
		<button on:click={unfollow}><IconTrash /></button>
	</div>
{:else if $authorPubkey !== ''}
	<button on:click={follow} disabled={following}>Follow</button>
{/if}

<style>
	.following {
		display: flex;
		flex-direction: row;
	}

	.following button {
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
