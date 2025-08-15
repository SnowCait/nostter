<script lang="ts">
	import { Divider, Menu } from '@svelteuidev/core';
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { page } from '$app/stores';
	import { bookmark, unbookmark, isBookmarked } from '$lib/author/Bookmark';
	import { broadcast } from '$lib/Broadcast';
	import { copy } from '$lib/Clipboard';
	import { shareUrl } from '$lib/Share';
	import { rom, pubkey as authorPubkey, mutePubkeys, muteEventIds } from '$lib/stores/Author';
	import { developerMode } from '$lib/stores/Preference';
	import IconDots from '@tabler/icons-svelte/icons/dots';
	import IconBookmark from '@tabler/icons-svelte/icons/bookmark';
	import IconBookmarkFilled from '@tabler/icons-svelte/icons/bookmark-filled';
	import IconClipboard from '@tabler/icons-svelte/icons/clipboard';
	import IconLink from '@tabler/icons-svelte/icons/link';
	import IconCode from '@tabler/icons-svelte/icons/code';
	import IconCodeDots from '@tabler/icons-svelte/icons/code-dots';
	import IconBroadcast from '@tabler/icons-svelte/icons/broadcast';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import IconVolumeOff from '@tabler/icons-svelte/icons/volume-off';
	import IconExternalLink from '@tabler/icons-svelte/icons/external-link';
	import { IconLanguage } from '@tabler/icons-svelte';
	import { deleteEvent } from '$lib/author/Delete';
	import { mute, unmute } from '$lib/author/Mute';
	import { referTags } from '$lib/EventHelper';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';

	export let event: Event;
	export let iconSize: number;
	export let showDetails = false;

	$: bookmarked = isBookmarked(event);
	$: nevent = nip19.neventEncode({
		id: event.id,
		relays: getSeenOnRelays(event.id),
		author: event.pubkey,
		kind: event.kind
	});
	$: url = `${$page.url.origin}/${nevent}`;
	$: rootId = referTags(event).root?.at(1) ?? event.id;

	async function onBookmark(note: Event) {
		console.log('[bookmark]', note, $rom);

		if (bookmarked) {
			console.debug('[bookmark already]');
			return;
		}

		bookmarked = true;

		try {
			await bookmark(['e', note.id]);
		} catch (error) {
			console.error('[bookmark failed]', error);
			bookmarked = false;
			alert($_('actions.bookmark.failed'));
		}
	}

	async function onUnbookmark(note: Event) {
		console.log('[unbookmark]', note, $rom);

		if (!confirm($_('actions.unbookmark.confirm'))) {
			return;
		}

		bookmarked = false;

		try {
			await unbookmark(['e', note.id]);
		} catch (error) {
			console.error('[remove bookmark failed]', error);
			bookmarked = true;
			alert($_('actions.unbookmark.failed'));
		}
	}

	function embed(): void {
		const html = [
			'<script type="module" src="https://cdn.jsdelivr.net/npm/nostr-widgets/dist/nostr-widgets.js"><\/script>',
			`<nostr-note data='${JSON.stringify(event)}'></nostr-note>`
		].join('');
		copy(html);
	}

	async function onDelete(): Promise<void> {
		if (!confirm($_('actions.delete.confirm'))) {
			return;
		}

		console.log('[delete]', event);
		await deleteEvent([event]);
	}

	async function onMute(): Promise<void> {
		console.debug('[mute pubkey]', event.pubkey);

		try {
			await mute('p', event.pubkey);
		} catch (error) {
			console.error('[mute failed]', error);
			alert($_('actions.mute.failed'));
		}
	}

	async function onUnmute(): Promise<void> {
		console.debug('[unmute pubkey]', event.pubkey);

		try {
			await unmute('p', event.pubkey);
		} catch (error) {
			console.error('[unmute failed]', error);
			alert($_('actions.unmute.failed'));
		}
	}

	async function onMuteThread(): Promise<void> {
		console.debug('[mute thread]', rootId);

		try {
			await mute('e', rootId);
		} catch (error) {
			console.error('[mute failed]', error);
			alert($_('actions.mute.failed'));
		}
	}

	async function onUnmuteThread(): Promise<void> {
		console.debug('[unmute thread]', rootId);

		try {
			await unmute('e', rootId);
		} catch (error) {
			console.error('[unmute failed]', error);
			alert($_('actions.unmute.failed'));
		}
	}
</script>

<Menu placement="center">
	<svelte:fragment slot="control">
		<div class="icon">
			<IconDots size={iconSize} />
		</div>
	</svelte:fragment>

	{#if bookmarked}
		<Menu.Item
			icon={IconBookmarkFilled}
			color="var(--red)"
			disabled={$rom || event.kind === 42}
			on:click={() => onUnbookmark(event)}
		>
			{$_('actions.unbookmark.button')}
		</Menu.Item>
	{:else}
		<Menu.Item
			icon={IconBookmark}
			disabled={$rom || event.kind === 42}
			on:click={() => onBookmark(event)}
		>
			{$_('actions.bookmark.button')}
		</Menu.Item>
	{/if}

	<Menu.Item icon={IconClipboard} on:click={() => copy(nevent)}>
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

	<Menu.Item icon={IconCode} on:click={embed}>
		{$_('actions.embed.button')}
	</Menu.Item>

	<Menu.Item
		icon={IconLanguage}
		on:click={() =>
			open(
				$_('thread.translation.url').replace('{0}', encodeURIComponent(event.content)),
				'_blank',
				'noopener,noreferrer'
			)}
	>
		{$_('thread.translation.title')}
		<svelte:fragment slot="rightSection">
			<IconExternalLink size={16} />
		</svelte:fragment>
	</Menu.Item>

	{#if event.pubkey === $authorPubkey}
		<Divider />
		<Menu.Label>{$_('menu.caution')}</Menu.Label>
		<Menu.Item icon={IconTrash} on:click={onDelete}>
			{$_('actions.delete.button')}
		</Menu.Item>
	{/if}

	<Divider />

	<Menu.Label>{$_('preferences.mute.mute')}</Menu.Label>

	{#if $mutePubkeys.includes(event.pubkey)}
		<Menu.Item icon={IconVolumeOff} color="var(--red)" on:click={onUnmute}>
			{$_('actions.unmute.user')}
		</Menu.Item>
	{:else if event.pubkey !== $authorPubkey}
		<Menu.Item icon={IconVolumeOff} on:click={onMute}>
			{$_('actions.mute.user')}
		</Menu.Item>
	{/if}

	{#if $muteEventIds.includes(rootId)}
		<Menu.Item icon={IconVolumeOff} color="var(--red)" on:click={onUnmuteThread}>
			{$_('actions.unmute.thread')}
		</Menu.Item>
	{:else}
		<Menu.Item icon={IconVolumeOff} on:click={onMuteThread}>
			{$_('actions.mute.thread')}
		</Menu.Item>
	{/if}

	{#if $developerMode}
		<Divider />
		<Menu.Label>{$_('menu.developer')}</Menu.Label>
		<Menu.Item icon={IconCodeDots} on:click={() => (showDetails = !showDetails)}>
			{$_('actions.details.button')}
		</Menu.Item>
		<Menu.Item icon={IconBroadcast} on:click={() => broadcast(event)}>
			{$_('actions.broadcast.button')}
		</Menu.Item>
	{/if}
</Menu>

<style>
	.icon {
		color: var(--accent-gray);
	}
</style>
