<script lang="ts">
	import { Divider, Menu } from '@svelteuidev/core';
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { page } from '$app/stores';
	import { bookmark, unbookmark, isBookmarked } from '$lib/author/Bookmark';
	import { copy } from '$lib/Clipboard';
	import { rom } from '../../stores/Author';
	import { developerMode } from '../../stores/Preference';
	import IconDots from '@tabler/icons-svelte/dist/svelte/icons/IconDots.svelte';
	import IconBookmark from '@tabler/icons-svelte/dist/svelte/icons/IconBookmark.svelte';
	import IconBookmarkFilled from '@tabler/icons-svelte/dist/svelte/icons/IconBookmarkFilled.svelte';
	import IconClipboard from '@tabler/icons-svelte/dist/svelte/icons/IconClipboard.svelte';
	import IconLink from '@tabler/icons-svelte/dist/svelte/icons/IconLink.svelte';
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';

	export let event: Event;
	export let iconSize: number;
	export let showDetails = false;

	$: bookmarked = isBookmarked(event);

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

	<Menu.Item icon={IconClipboard} on:click={() => copy(nip19.neventEncode({ id: event.id }))}>
		{$_('actions.copy_id.button')}
	</Menu.Item>

	<Menu.Item
		icon={IconLink}
		on:click={() => copy(`${$page.url.origin}/${nip19.neventEncode({ id: event.id })}`)}
	>
		{$_('actions.copy_url.button')}
	</Menu.Item>

	{#if $developerMode}
		<Divider />
		<Menu.Label>Developer</Menu.Label>
		<Menu.Item icon={IconCodeDots} on:click={() => (showDetails = !showDetails)}>
			{$_('actions.details.button')}
		</Menu.Item>
	{/if}
</Menu>

<style>
	.icon {
		color: var(--accent-gray);
	}
</style>
