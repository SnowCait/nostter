<script lang="ts">
	import IconTrash from '@tabler/icons-svelte/dist/svelte/icons/IconTrash.svelte';
	import { Api } from '$lib/Api';
	import { pool } from '../stores/Pool';
	import { followees, pubkey as authorPubkey, writeRelays } from '../stores/Author';
	import { nip19, type Event, Kind } from 'nostr-tools';

	export let pubkey: string;

	let following = false;

	const api = new Api($pool, $writeRelays);

	async function follow() {
		console.log('[on.follow]');

		following = true;

		const contactList = await api.fetchContactListEvent($authorPubkey);
		console.log('[contact list]', contactList);
		if (contactList === undefined) {
			console.error('Contact list not found');
			return;
		}

		const pubkeys = new Set(
			contactList.tags.filter(([tagName]) => tagName === 'p').map(([, pubkey]) => pubkey)
		);
		pubkeys.add(pubkey);

		await updateContactList(Array.from(pubkeys), contactList);

		following = false;
	}

	async function unfollow() {
		console.log('[on.unfollow]');

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

		const contactList = await api.fetchContactListEvent($authorPubkey);
		console.log('[contact list]', contactList);
		if (contactList === undefined) {
			console.error('Contact list not found');
			return;
		}

		const pubkeys = new Set(
			contactList.tags.filter(([tagName]) => tagName === 'p').map(([, pubkey]) => pubkey)
		);
		pubkeys.delete(pubkey);

		await updateContactList(Array.from(pubkeys), contactList);
	}

	async function updateContactList(pubkeys: string[], oldEvent: Event) {
		try {
			await api.signAndPublish(
				Kind.Contacts,
				oldEvent.content,
				pubkeys.map((pubkey) => ['p', pubkey])
			);
		} catch (error) {
			console.error('[failed]', error);
			alert('Failed to update contact list');
			return;
		}

		// Update cache
		console.log($followees, pubkeys);
		$followees = pubkeys;
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
