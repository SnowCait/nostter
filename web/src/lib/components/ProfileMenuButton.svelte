<script lang="ts">
	import { Divider, Menu, Text } from '@svelteuidev/core';
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { follow, unfollow } from '$lib/author/Follow';
	import { mute, unmute } from '$lib/author/Mute';
	import { muteByKind, unmuteByKind } from '$lib/author/MuteKind';
	import { metadataStore } from '$lib/cache/Events';
	import {
		pubkey as authorPubkey,
		mutedPubkeysByKindMap,
		mutePubkeys,
		originalFollowees
	} from '$lib/stores/Author';
	import { developerMode } from '$lib/stores/Preference';
	import { copy } from '$lib/Clipboard';
	import { alternativeName } from '$lib/Items';
	import { shareUrl } from '$lib/Share';
	import IconDots from '@tabler/icons-svelte/icons/dots';
	import IconList from '@tabler/icons-svelte/icons/list';
	import IconClipboard from '@tabler/icons-svelte/icons/clipboard';
	import IconLink from '@tabler/icons-svelte/icons/link';
	import IconAffiliate from '@tabler/icons-svelte/icons/affiliate';
	import IconUserPlus from '@tabler/icons-svelte/icons/user-plus';
	import IconUserMinus from '@tabler/icons-svelte/icons/user-minus';
	import IconVolumeOff from '@tabler/icons-svelte/icons/volume-off';
	import IconRSS from '@tabler/icons-svelte/icons/rss';
	import IconExternalLink from '@tabler/icons-svelte/icons/external-link';
	import ListDialog from './actions/ListDialog.svelte';

	export let pubkey: string;

	$: metadata = $metadataStore.get(pubkey);
	$: nprofile = nip19.nprofileEncode({ pubkey });
	$: url = `${$page.url.origin}/${metadata?.normalizedNip05 ? metadata.normalizedNip05 : nprofile}`;

	let listDialogOpen = false;

	function editLists(): void {
		listDialogOpen = true;
	}

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

		try {
			await unmute('p', pubkey);
		} catch (error) {
			console.error('[unmute failed]', error);
			alert('Failed to unmute.');
		}
	}

	async function muteReposts(): Promise<void> {
		console.log('[mute reposts]', pubkey);

		try {
			await Promise.allSettled([6, 16].map((kind) => muteByKind(kind, pubkey)));
		} catch (error) {
			console.error('[mute reposts failed]', error);
			alert('Failed to mute reposts.');
		}
	}

	async function unmuteReposts(): Promise<void> {
		console.log('[unmute reposts]', pubkey);

		try {
			await Promise.allSettled([6, 16].map((kind) => unmuteByKind(kind, pubkey)));
		} catch (error) {
			console.error('[unmute reposts failed]', error);
			alert('Failed to unmute reposts.');
		}
	}

	async function muteReactions(): Promise<void> {
		console.log('[mute reactions]', pubkey);

		try {
			await muteByKind(7, pubkey);
		} catch (error) {
			console.error('[mute reactions failed]', error);
			alert('Failed to mute reactions.');
		}
	}

	async function unmuteReactions(): Promise<void> {
		console.log('[unmute reactions]', pubkey);

		try {
			await unmuteByKind(7, pubkey);
		} catch (error) {
			console.error('[unmute reactions failed]', error);
			alert('Failed to unmute reactions.');
		}
	}

	async function muteZaps(): Promise<void> {
		console.log('[mute zaps]', pubkey);

		try {
			await muteByKind(9735, pubkey);
		} catch (error) {
			console.error('[mute zaps failed]', error);
			alert('Failed to mute zaps.');
		}
	}

	async function unmuteZaps(): Promise<void> {
		console.log('[unmute zaps]', pubkey);

		try {
			await unmuteByKind(9735, pubkey);
		} catch (error) {
			console.error('[unmute zaps failed]', error);
			alert('Failed to unmute zaps.');
		}
	}
</script>

<Menu placement="center">
	<svelte:fragment slot="control">
		<div class="icon">
			<IconDots />
		</div>
	</svelte:fragment>

	<Menu.Item icon={IconList} on:click={editLists}>
		{$_('lists.edit')}
	</Menu.Item>

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

	<Menu.Item
		icon={IconRSS}
		on:click={() => open(`https://njump.me/${nprofile}.rss`, '_blank', 'noopener,noreferrer')}
	>
		<svelte:fragment slot="rightSection">
			<Text><IconExternalLink size={16} /></Text>
		</svelte:fragment>
		RSS
	</Menu.Item>

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

	{#if $mutedPubkeysByKindMap.get(6)?.has(pubkey)}
		<Menu.Item icon={IconVolumeOff} color="var(--red)" on:click={() => unmuteReposts()}>
			{$_('actions.unmute.reposts')}
		</Menu.Item>
	{:else}
		<Menu.Item icon={IconVolumeOff} on:click={() => muteReposts()}>
			{$_('actions.mute.reposts')}
		</Menu.Item>
	{/if}

	{#if $mutedPubkeysByKindMap.get(7)?.has(pubkey)}
		<Menu.Item icon={IconVolumeOff} color="var(--red)" on:click={() => unmuteReactions()}>
			{$_('actions.unmute.reactions')}
		</Menu.Item>
	{:else}
		<Menu.Item icon={IconVolumeOff} on:click={() => muteReactions()}>
			{$_('actions.mute.reactions')}
		</Menu.Item>
	{/if}

	{#if $mutedPubkeysByKindMap.get(9735)?.has(pubkey)}
		<Menu.Item icon={IconVolumeOff} color="var(--red)" on:click={() => unmuteZaps()}>
			{$_('actions.unmute.zaps')}
		</Menu.Item>
	{:else}
		<Menu.Item icon={IconVolumeOff} on:click={() => muteZaps()}>
			{$_('actions.mute.zaps')}
		</Menu.Item>
	{/if}

	{#if $developerMode && pubkey === $authorPubkey}
		<Divider />

		<Menu.Label>{$_('menu.developer')}</Menu.Label>

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

<ListDialog {pubkey} bind:open={listDialogOpen} />

<style>
	.icon {
		color: var(--accent-gray);
		width: 34px;
		height: 34px;
		padding: 8px;
	}
</style>
