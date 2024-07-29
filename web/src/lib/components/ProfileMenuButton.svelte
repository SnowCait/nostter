<script lang="ts">
	import { Divider, Menu } from '@svelteuidev/core';
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { follow, unfollow } from '$lib/author/Follow';
	import { mute, unmute } from '$lib/author/Mute';
	import { metadataStore } from '$lib/cache/Events';
	import { pubkey as authorPubkey, mutePubkeys, originalFollowees } from '$lib/stores/Author';
	import { copy } from '$lib/Clipboard';
	import { alternativeName } from '$lib/Items';
	import { shareUrl } from '$lib/Share';
	import IconDots from '@tabler/icons-svelte/icons/dots';
	import IconClipboard from '@tabler/icons-svelte/icons/clipboard';
	import IconLink from '@tabler/icons-svelte/icons/link';
	import IconAffiliate from '@tabler/icons-svelte/icons/affiliate';
	import IconUserPlus from '@tabler/icons-svelte/icons/user-plus';
	import IconUserMinus from '@tabler/icons-svelte/icons/user-minus';
	import IconVolumeOff from '@tabler/icons-svelte/icons/volume-off';

	export let pubkey: string;

	$: nprofile = nip19.nprofileEncode({ pubkey });
	$: url = `${$page.url.origin}/${nprofile}`;

	async function onFollow(): Promise<void> {
		console.log('[follow]');

		try {
			await follow([pubkey]);
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
			await unfollow([pubkey]);
		} catch (error) {
			console.error('[unfollow failed]', error);
			alert('Failed to unfollow.');
		}
	}

	async function onMute(): Promise<void> {
		console.log('[mute pubkey]');

		try {
			await mute('p', pubkey);
		} catch (error) {
			console.error('[mute failed]', error);
			alert('Failed to mute.');
		}
	}

	async function onUnmute(): Promise<void> {
		console.log('[unmute pubkey]');

		const metadata = $metadataStore.get(pubkey);

		if (!confirm(`Unmute @${metadata?.displayName ?? alternativeName(pubkey)}?`)) {
			console.log('[unmute cancelled]');
			return;
		}

		try {
			await unmute('p', pubkey);
		} catch (error) {
			console.error('[unmute failed]', error);
			alert('Failed to unmute.');
		}
	}
</script>

<Menu placement="center">
	<svelte:fragment slot="control">
		<div class="icon">
			<IconDots />
		</div>
	</svelte:fragment>

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

	<Divider />

	<Menu.Label>{$_('preferences.mute.mute')}</Menu.Label>

	{#if $mutePubkeys.includes(pubkey)}
		<Menu.Item icon={IconVolumeOff} color="var(--red)" on:click={onUnmute}>
			{$_('actions.unmute.button')}
		</Menu.Item>
	{:else}
		<Menu.Item icon={IconVolumeOff} on:click={onMute}>
			{$_('actions.mute.button')}
		</Menu.Item>
	{/if}
</Menu>

<style>
	.icon {
		color: var(--accent-gray);
		width: 34px;
		height: 34px;
		padding: 8px;
	}
</style>
