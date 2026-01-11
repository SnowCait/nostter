<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { ShortTextNote, EncryptedDirectMessage, Repost } from 'nostr-tools/kinds';
	import type { Event } from 'nostr-typedef';
	import { repostedEvents, updateRepostedEvents } from '$lib/author/Action';
	import { Signer } from '$lib/Signer';
	import { rom } from '$lib/stores/Author';
	import { openNoteDialog, quotes } from '$lib/stores/NoteDialog';
	import { getRelayHint, rxNostr, seenOn } from '$lib/timelines/MainTimeline';
	import { createDropdownMenu, melt } from '@melt-ui/svelte';
	import { IconQuote, IconRepeat, IconTrash } from '@tabler/icons-svelte';
	import { undoRepost } from '$lib/author/Repost';

	interface Props {
		event: Event;
		iconSize: number;
	}

	let { event, iconSize }: Props = $props();

	const {
		elements: { menu, item, trigger, overlay, separator }
	} = createDropdownMenu({ preventScroll: false });

	let reposted = $derived($repostedEvents.has(event.id) && $repostedEvents.get(event.id)!.length > 0);

	async function onRepost(): Promise<void> {
		console.debug('[repost]', event);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		const eTag = ['e', event.id];
		const relay = getRelayHint(event.id);
		if (relay) {
			eTag.push(relay);
		}

		const repostEvent = await Signer.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: Repost,
			tags: [eTag, ['p', event.pubkey]],
			content: ''
		});
		console.debug(repostEvent, seenOn.get(event.id));

		rxNostr.send(repostEvent);
		updateRepostedEvents([repostEvent]);
	}

	function onUndoRepost(): void {
		console.debug('[repost undo]', event);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		undoRepost(event);
	}

	function onQuote(): void {
		$quotes.push(event);
		$openNoteDialog = true;
	}
</script>

<button
	class="clear"
	class:hidden={event.kind === EncryptedDirectMessage}
	class:reposted
	use:melt={$trigger}
>
	<IconRepeat size={iconSize} />
</button>
<div use:melt={$overlay} class="overlay"></div>
<div use:melt={$menu} class="menu">
	{#if event.kind === ShortTextNote}
		<div use:melt={$item} onm-click={onRepost} class="item">
			<div class="icon"><IconRepeat size={iconSize} /></div>
			{#if reposted}
				<div>{$_('actions.repost.again')}</div>
			{:else}
				<div>{$_('actions.repost.button')}</div>
			{/if}
		</div>
	{/if}
	<div use:melt={$item} onm-click={onQuote} class="item">
		<div class="icon"><IconQuote size={iconSize} /></div>
		<div>{$_('actions.quote.button')}</div>
	</div>
	{#if event.kind === ShortTextNote && reposted}
		<div use:melt={$separator} class="separator"></div>
		<div class="text">{$_('menu.caution')}</div>
		<div use:melt={$item} onm-click={onUndoRepost} class="item">
			<div class="icon"><IconTrash size={iconSize} /></div>
			<div>{$_('actions.repost.undo')}</div>
		</div>
	{/if}
</div>

<style>
	button {
		color: var(--accent-gray);
	}

	button.reposted {
		color: var(--green);
	}
</style>
