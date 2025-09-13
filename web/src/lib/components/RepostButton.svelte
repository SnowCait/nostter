<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { ShortTextNote, EncryptedDirectMessage, Repost } from 'nostr-tools/kinds';
	import type { Event } from 'nostr-typedef';
	import { repostedEventIds, updateRepostedEvents } from '$lib/author/Action';
	import { Signer } from '$lib/Signer';
	import { rom } from '$lib/stores/Author';
	import { openNoteDialog, quotes } from '$lib/stores/NoteDialog';
	import IconRepeat from '@tabler/icons-svelte/icons/repeat';
	import IconQuote from '@tabler/icons-svelte/icons/quote';
	import { getRelayHint, rxNostr, seenOn } from '$lib/timelines/MainTimeline';
	import { createDropdownMenu, melt } from '@melt-ui/svelte';
	import '$lib/styles/menu.css';

	export let event: Event;
	export let iconSize: number;

	const {
		elements: { menu, item, trigger, overlay }
	} = createDropdownMenu({ preventScroll: false });

	$: reposted = $repostedEventIds.has(event.id);

	async function repost(e: any): Promise<void> {
		const target = e.currentTarget as HTMLElement;
		if (target.hasAttribute('data-disabled')) {
			return;
		}
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

	function quote(): void {
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
<div use:melt={$overlay} class="overlay" />
<div use:melt={$menu} class="menu">
	{#if event.kind === ShortTextNote}
		<div use:melt={$item} on:m-click={repost} class="item">
			<div class="icon"><IconRepeat size={iconSize} /></div>
			{#if reposted}
				<div>{$_('actions.repost.again')}</div>
			{:else}
				<div>{$_('actions.repost.button')}</div>
			{/if}
		</div>
	{/if}
	<div use:melt={$item} on:m-click={quote} class="item">
		<div class="icon"><IconQuote size={iconSize} /></div>
		<div>{$_('actions.quote.button')}</div>
	</div>
</div>

<style>
	button {
		color: var(--accent-gray);
	}

	button.reposted {
		color: var(--green);
	}
</style>
