<script lang="ts">
	import { Menu } from '@svelteuidev/core';
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { page } from '$app/stores';
	import { copy } from '$lib/Clipboard';
	import { shareUrl } from '$lib/Share';
	import IconClipboard from '@tabler/icons-svelte/dist/svelte/icons/IconClipboard.svelte';
	import IconLink from '@tabler/icons-svelte/dist/svelte/icons/IconLink.svelte';

	export let event: Event;

	$: nprofile = nip19.nprofileEncode({ pubkey: event.pubkey });
	$: url = `${$page.url.origin}/${nprofile}`;
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
</Menu>
