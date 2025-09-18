<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { findIdentifier } from '$lib/EventHelper';
	import { IconDots } from '@tabler/icons-svelte';
	import IconExternalLink from '@tabler/icons-svelte/icons/external-link';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { createDropdownMenu, melt } from '@melt-ui/svelte';

	export let event: Event;

	const {
		elements: { menu, item, trigger, overlay }
	} = createDropdownMenu({ preventScroll: false });

	$: naddr = nip19.naddrEncode({
		kind: event.kind,
		pubkey: event.pubkey,
		identifier: findIdentifier(event.tags) ?? '',
		relays: getSeenOnRelays(event.id)
	});
	$: emojitoUrl = `https://emojito.meme/a/${naddr}`;
</script>

<button class="clear" use:melt={$trigger}>
	<IconDots size={20} />
</button>
<div use:melt={$overlay} class="overlay" />
<div use:melt={$menu} class="menu">
	<div use:melt={$item} on:m-click={() => window.open(emojitoUrl)} class="item">
		<div class="icon"><IconExternalLink size={20} /></div>
		<div>{$_('actions.open_url.button').replace('%s', 'emojito')}</div>
	</div>
</div>

<style>
	button {
		color: var(--accent-gray);
	}
</style>
