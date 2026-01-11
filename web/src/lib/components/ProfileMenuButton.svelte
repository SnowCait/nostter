<script lang="ts">
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
		originalFollowees,
		rom
	} from '$lib/stores/Author';
	import { developerMode } from '$lib/stores/Preference';
	import { copy } from '$lib/Clipboard';
	import { alternativeName } from '$lib/Items';
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
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { createDropdownMenu, melt } from '@melt-ui/svelte';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	const {
		elements: { menu, item, trigger, overlay, separator }
	} = createDropdownMenu({ preventScroll: false });

	let metadata = $derived($metadataStore.get(pubkey));
	let npub = $derived(nip19.npubEncode(pubkey));
	let nprofile = $derived(nip19.nprofileEncode({
		pubkey,
		relays: metadata ? getSeenOnRelays(metadata.event.id) : undefined
	}));
	let url = $derived(`${$page.url.origin}/${metadata?.normalizedNip05 ? metadata.normalizedNip05 : nprofile}`);

	let listDialogOpen = $state(false);

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
			alert($_('actions.mute.failed'));
		}
	}

	async function onUnmute(): Promise<void> {
		console.log('[unmute pubkey]');

		try {
			await unmute('p', pubkey);
		} catch (error) {
			console.error('[unmute failed]', error);
			alert($_('actions.unmute.failed'));
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

<button class="clear" use:melt={$trigger}>
	<IconDots />
</button>
<div use:melt={$overlay} class="overlay"></div>
<div use:melt={$menu} class="menu">
	{#if $authorPubkey && !$rom}
		<div use:melt={$item} onm-click={editLists} class="item">
			<div class="icon"><IconList /></div>
			<div>{$_('lists.edit')}</div>
		</div>
	{/if}
	<div use:melt={$item} onm-click={() => copy(npub)} class="item">
		<div class="icon"><IconClipboard /></div>
		<div>{$_('actions.copy_npub.button')}</div>
	</div>
	<div use:melt={$item} onm-click={() => copy(nprofile)} class="item">
		<div class="icon"><IconClipboard /></div>
		<div>{$_('actions.copy_nprofile.button')}</div>
	</div>
	<div use:melt={$item} onm-click={() => copy(url)} class="item">
		<div class="icon"><IconLink /></div>
		<div>{$_('actions.copy_url.button')}</div>
	</div>
	<div use:melt={$item} onm-click={async () => await goto(`/${nprofile}/relays`)} class="item">
		<div class="icon"><IconAffiliate /></div>
		<div>{$_('pages.relays')}</div>
	</div>
	<div
		use:melt={$item}
		onm-click={() =>
			open(`https://nostr.com/${nprofile}.rss`, '_blank', 'noopener,noreferrer')}
		class="item"
	>
		<div class="icon"><IconRSS /></div>
		<div>RSS</div>
		<div class="secondary-icon"><IconExternalLink /></div>
	</div>
	{#if $authorPubkey && !$rom}
		<div use:melt={$separator} class="separator"></div>
		<div class="text">{$_('preferences.mute.mute')}</div>
		{#if $mutePubkeys.includes(pubkey)}
			<div use:melt={$item} onm-click={onUnmute} class="item undo">
				<div class="icon"><IconVolumeOff /></div>
				<div>{$_('actions.unmute.button')}</div>
			</div>
		{:else if pubkey !== $authorPubkey}
			<div use:melt={$item} onm-click={onMute} class="item">
				<div class="icon"><IconVolumeOff /></div>
				<div>{$_('actions.mute.button')}</div>
			</div>
		{/if}
		{#if $mutedPubkeysByKindMap.get(6)?.has(pubkey)}
			<div use:melt={$item} onm-click={unmuteReposts} class="item undo">
				<div class="icon"><IconVolumeOff /></div>
				<div>{$_('actions.unmute.reposts')}</div>
			</div>
		{:else}
			<div use:melt={$item} onm-click={muteReposts} class="item">
				<div class="icon"><IconVolumeOff /></div>
				<div>{$_('actions.mute.reposts')}</div>
			</div>
		{/if}
		{#if $mutedPubkeysByKindMap.get(7)?.has(pubkey)}
			<div use:melt={$item} onm-click={unmuteReactions} class="item undo">
				<div class="icon"><IconVolumeOff /></div>
				<div>{$_('actions.unmute.reactions')}</div>
			</div>
		{:else}
			<div use:melt={$item} onm-click={muteReactions} class="item">
				<div class="icon"><IconVolumeOff /></div>
				<div>{$_('actions.mute.reactions')}</div>
			</div>
		{/if}
		{#if $mutedPubkeysByKindMap.get(9735)?.has(pubkey)}
			<div use:melt={$item} onm-click={unmuteZaps} class="item undo">
				<div class="icon"><IconVolumeOff /></div>
				<div>{$_('actions.unmute.zaps')}</div>
			</div>
		{:else}
			<div use:melt={$item} onm-click={muteZaps} class="item">
				<div class="icon"><IconVolumeOff /></div>
				<div>{$_('actions.mute.zaps')}</div>
			</div>
		{/if}
		{#if $developerMode && pubkey === $authorPubkey}
			<div use:melt={$separator} class="separator"></div>
			<div class="text">{$_('menu.developer')}</div>
			{#if $originalFollowees.includes(pubkey)}
				<div use:melt={$item} onm-click={onUnfollow} class="item">
					<div class="icon"><IconUserMinus /></div>
					<div>{$_('actions.unfollow.myself')}</div>
				</div>
			{:else}
				<div use:melt={$item} onm-click={onFollow} class="item">
					<div class="icon"><IconUserPlus /></div>
					<div>{$_('actions.follow.myself')}</div>
				</div>
			{/if}
		{/if}
	{/if}
</div>

<ListDialog {pubkey} bind:open={listDialogOpen} />

<style>
	button {
		color: var(--accent-gray);
		width: 34px;
		height: 34px;
		display: flex;
		justify-content: center;
		align-items: center;
	}
</style>
