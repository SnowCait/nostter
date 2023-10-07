<script lang="ts">
	import { Api } from '$lib/Api';
	import { pool } from '../../stores/Pool';
	import { followees, pubkey as authorPubkey, writeRelays } from '../../stores/Author';
	import { nip19 } from 'nostr-tools';
	import { Contacts } from '$lib/Contacts';
	import { _ } from 'svelte-i18n';

	export let pubkey: string;

	let processing = false;

	const api = new Api($pool, $writeRelays);

	async function follow() {
		console.log('[follow]');

		processing = true;

		try {
			const contacts = new Contacts($authorPubkey, $pool, $writeRelays);
			await contacts.follow(pubkey);
			$followees.push(pubkey);
			$followees = $followees;
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
		} catch (error) {
			console.error('[unfollow failed]', error);
			alert('Failed to unfollow.');
		}

		processing = false;
	}
</script>

{#if $followees.some((x) => x === pubkey)}
	<button on:click={unfollow} class="button-small button-outlined" disabled={processing}>
		{$_('following')}
	</button>
{:else}
	<button on:click={follow} class="button-small" disabled={processing}>
		{$_('follow')}
	</button>
{/if}

<style>
	button {
		display: flex;
		row-gap: 2px;
	}
	:global(button .loader > svg) {
		fill: white;
	}
</style>
