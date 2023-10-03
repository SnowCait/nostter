<script lang="ts">
	import { Api } from '$lib/Api';
	import { pool } from '../../stores/Pool';
	import { followees, pubkey as authorPubkey, writeRelays } from '../../stores/Author';
	import { nip19 } from 'nostr-tools';
	import { Contacts } from '$lib/Contacts';
	import { _ } from 'svelte-i18n';

	export let pubkey: string;

	let processing = false;
	let followingUser = $followees.some((x) => x === pubkey);

	const api = new Api($pool, $writeRelays);

	async function follow() {
		console.log('[follow]');

		processing = true;

		try {
			const contacts = new Contacts($authorPubkey, $pool, $writeRelays);
			await contacts.follow(pubkey);
			$followees.push(pubkey);
			$followees = $followees;
			followingUser = true;
		} catch (error) {
			console.error('[follow failed]', error);
			alert('Failed to follow.');
		}

		processing = false;
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

		processing = true;

		try {
			const contacts = new Contacts($authorPubkey, $pool, $writeRelays);
			await contacts.unfollow(pubkey);
			$followees = $followees.filter((x) => x !== pubkey);
			followingUser = false;
		} catch (error) {
			console.error('[unfollow failed]', error);
			alert('Failed to unfollow.');
		}

		processing = false;
	}
</script>

<div class="following">
	<button
		on:click={followingUser ? unfollow : follow}
		class={`button-small ${followingUser ? 'button-outlined' : ''}`}
		disabled={processing}
	>
		{followingUser ? $_('following') : $_('follow')}
	</button>
</div>

<style>
	button {
		display: flex;
		row-gap: 2px;
	}
	:global(button .loader > svg) {
		fill: white;
	}
</style>
