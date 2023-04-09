<script lang="ts" context="module">
	interface Window {
		// NIP-07
		nostr: any;
	}
	declare var window: Window;
</script>

<script lang="ts">
	import { IconTrash } from '@tabler/icons-svelte';
	import { Api } from '$lib/Api';
	import { pool } from '../stores/Pool';
	import { followees, relayUrls, pubkey as authorPubkey } from '../stores/Author';
	import { nip19, type Event } from 'nostr-tools';

	export let pubkey: string;

	async function follow() {
		console.log('[on.follow]');

		const api = new Api($pool, $relayUrls);
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

		await updateContactList(api, Array.from(pubkeys), contactList);
	}

	async function unfollow() {
		console.log('[on.unfollow]');

		const api = new Api($pool, $relayUrls);
		const userEvent = await api.fetchUserEvent(pubkey);

		if (
			!confirm(
				`Unfollow @${
					userEvent?.user.name ??
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

		await updateContactList(api, Array.from(pubkeys), contactList);
	}

	async function updateContactList(api: Api, pubkeys: string[], oldEvent: Event) {
		const event = await window.nostr.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: oldEvent.kind,
			tags: pubkeys.map((pubkey) => ['p', pubkey]),
			content: oldEvent.content
		});
		console.log(event);

		const success = await api.publish(event);
		if (!success) {
			console.error('[failed]');
			alert('Failed to update contact list');
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
	<button on:click={follow}>Follow</button>
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
