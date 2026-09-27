<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import type * as Nostr from 'nostr-typedef';
	import { findIdentifier } from '$lib/nostr/protocol/event-address';
	import { IconDots, IconExternalLink } from '@tabler/icons-svelte-runes';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { createDropdownMenu, melt } from '@melt-ui/svelte';
	import { emojiEditorUrl } from '$lib/Constants';

	interface Props {
		event: Nostr.Event;
	}

	let { event }: Props = $props();

	const {
		elements: { menu, item, trigger, overlay }
	} = createDropdownMenu({
		preventScroll: false,

		// Workaround for top layer (menu is hidden behind the top layer)
		onOpenChange: ({ next }) => {
			setTimeout(() => {
				if (next) {
					menuElement?.showPopover();
				} else {
					menuElement?.hidePopover();
				}
			}, 0);
			return next;
		}
	});

	let menuElement: HTMLElement | undefined;

	let naddr = $derived(
		nip19.naddrEncode({
			kind: event.kind,
			pubkey: event.pubkey,
			identifier: findIdentifier(event.tags) ?? '',
			relays: getSeenOnRelays(event.id)
		})
	);
	let url = $derived(`${emojiEditorUrl}#/a/${naddr}`);
</script>

<button class="clear" use:melt={$trigger}>
	<IconDots size={20} />
</button>
<div use:melt={$overlay} class="overlay"></div>
<div use:melt={$menu} class="menu" popover="auto" bind:this={menuElement}>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div use:melt={$item} onclick={() => window.open(url)} class="item">
		<div class="icon"><IconExternalLink size={20} /></div>
		<div>{$_('actions.open_url.button').replace('%s', 'emoemo')}</div>
	</div>
</div>

<style>
	button {
		color: var(--accent-gray);
	}

	[popover] {
		color: inherit;
		border-width: inherit;
	}
</style>
