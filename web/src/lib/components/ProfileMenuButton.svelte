<script lang="ts">
	import { Menu } from '@svelteuidev/core';
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { follow, unfollow } from '$lib/author/Follow';
	import { metadataStore } from '$lib/cache/Events';
	import { pubkey as authorPubkey, originalFollowees } from '$lib/stores/Author';
	import { copy } from '$lib/Clipboard';
	import { alternativeName } from '$lib/Items';
	import { shareUrl } from '$lib/Share';
	import IconClipboard from '@tabler/icons-svelte/dist/svelte/icons/IconClipboard.svelte';
	import IconLink from '@tabler/icons-svelte/dist/svelte/icons/IconLink.svelte';
	import IconAffiliate from '@tabler/icons-svelte/dist/svelte/icons/IconAffiliate.svelte';
	import IconUserPlus from '@tabler/icons-svelte/dist/svelte/icons/IconUserPlus.svelte';
	import IconUserMinus from '@tabler/icons-svelte/dist/svelte/icons/IconUserMinus.svelte';

	export let pubkey: string;

	$: nprofile = nip19.nprofileEncode({ pubkey });
	$: url = `${$page.url.origin}/${nprofile}`;

	async function onFollow(): Promise<void> {
		console.log('[follow]');

		try {
			await follow(pubkey);
		} catch (error) {
			console.error('[follow failed]', error);
			alert('Failed to follow.');
		}
	}

	async function onUnfollow(): Promise<void> {
		console.log('[unfollow]');

		const metadata = $metadataStore.get(pubkey);

		if (!confirm(`Unfollow @${metadata?.displayName ?? alternativeName(pubkey)}?`)) {
			console.log('[unfollow cancelled]');
			return;
		}

		try {
			await unfollow(pubkey);
		} catch (error) {
			console.error('[unfollow failed]', error);
			alert('Failed to unfollow.');
		}
	}
</script>

<Menu placement="center">
	<Menu.Item icon={IconClipboard} on:click={() => copy(nprofile)}>
		{$_('actions.copy_id.button')}
	</Menu.Item>

	{#if navigator.canShare !== undefined}
		<Menu.Item
			icon={IconLink}
			on:click={async () => {
				if (!(await shareUrl(url))) {
					await copy(url);
				}
			}}
		>
			{$_('actions.share.button')}
		</Menu.Item>
	{:else}
		<Menu.Item icon={IconLink} on:click={() => copy(url)}>
			{$_('actions.copy_url.button')}
		</Menu.Item>
	{/if}

	<Menu.Item icon={IconAffiliate} on:click={async () => await goto(`/${nprofile}/relays`)}>
		{$_('pages.relays')}
	</Menu.Item>

	{#if pubkey === $authorPubkey}
		{#if $originalFollowees.includes(pubkey)}
			<Menu.Item icon={IconUserMinus} color="var(--red)" on:click={onUnfollow}>
				{$_('actions.unfollow.myself')}
			</Menu.Item>
		{:else}
			<Menu.Item icon={IconUserPlus} on:click={onFollow}>
				{$_('actions.follow.myself')}
			</Menu.Item>
		{/if}
	{/if}
</Menu>
