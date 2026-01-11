<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { aTagContent, findIdentifier } from '$lib/EventHelper';
	import { IconDots, IconLibraryMinus, IconLibraryPlus } from '@tabler/icons-svelte';
	import IconExternalLink from '@tabler/icons-svelte/icons/external-link';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { createDropdownMenu, melt } from '@melt-ui/svelte';
	import {
		addToEmojiList,
		customEmojiListEvent,
		removeFromEmojiList
	} from '$lib/author/CustomEmojis';

	interface Props {
		event: Event;
	}

	let { event }: Props = $props();

	const {
		elements: { menu, item, trigger, overlay }
	} = createDropdownMenu({ preventScroll: false });

	let address = $derived(aTagContent(event));
	let naddr = $derived(nip19.naddrEncode({
		kind: event.kind,
		pubkey: event.pubkey,
		identifier: findIdentifier(event.tags) ?? '',
		relays: getSeenOnRelays(event.id)
	}));
	let emojitoUrl = $derived(`https://emojito.meme/a/${naddr}`);

	async function add(): Promise<void> {
		try {
			await addToEmojiList(address);
		} catch {
			alert($_('emoji.custom.failed'));
		}
	}

	async function remove(): Promise<void> {
		try {
			await removeFromEmojiList(address);
		} catch {
			alert($_('emoji.custom.failed'));
		}
	}
</script>

<button class="clear" use:melt={$trigger}>
	<IconDots size={20} />
</button>
<div use:melt={$overlay} class="overlay"></div>
<div use:melt={$menu} class="menu">
	{#if !$customEmojiListEvent?.tags.some((tag) => tag[0] === 'a' && tag[1] === address)}
		<div use:melt={$item} onm-click={add} class="item">
			<div class="icon"><IconLibraryPlus size={20} /></div>
			<div>{$_('emoji.custom.add')}</div>
		</div>
	{/if}
	{#if $customEmojiListEvent?.tags.some((tag) => tag[0] === 'a' && tag[1] === address)}
		<div use:melt={$item} onm-click={remove} class="item">
			<div class="icon"><IconLibraryMinus size={20} /></div>
			<div>{$_('emoji.custom.remove')}</div>
		</div>
	{/if}
	<div use:melt={$item} onm-click={() => window.open(emojitoUrl)} class="item">
		<div class="icon"><IconExternalLink size={20} /></div>
		<div>{$_('actions.open_url.button').replace('%s', 'emojito')}</div>
	</div>
</div>

<style>
	button {
		color: var(--accent-gray);
	}
</style>
