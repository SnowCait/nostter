<script lang="ts">
	import { Menu } from '@svelteuidev/core';
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { findIdentifier } from '$lib/EventHelper';
	import IconDots from '@tabler/icons-svelte/dist/svelte/icons/IconDots.svelte';
	import IconExternalLink from '@tabler/icons-svelte/dist/svelte/icons/IconExternalLink.svelte';

	export let event: Event;

	$: naddr = nip19.naddrEncode({
		kind: event.kind,
		pubkey: event.pubkey,
		identifier: findIdentifier(event.tags) ?? ''
	});
	$: emojitoUrl = `https://emojito.meme/a/${naddr}`;
</script>

<Menu placement="center">
	<svelte:fragment slot="control">
		<div class="icon">
			<IconDots />
		</div>
	</svelte:fragment>

	<Menu.Item icon={IconExternalLink} on:click={() => window.open(emojitoUrl)}>
		{$_('actions.open_url.button').replace('%s', 'emojito')}
	</Menu.Item>
</Menu>

<style>
	.icon {
		color: var(--accent-gray);
	}
</style>
