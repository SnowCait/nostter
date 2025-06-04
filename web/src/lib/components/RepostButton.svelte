<script lang="ts">
	import { Menu } from '@svelteuidev/core';
	import { _ } from 'svelte-i18n';
	import { kinds as Kind } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { repostedEventIds, updateRepostedEvents } from '$lib/author/Action';
	import { Signer } from '$lib/Signer';
	import { rom } from '$lib/stores/Author';
	import { openNoteDialog, quotes } from '$lib/stores/NoteDialog';
	import IconRepeat from '@tabler/icons-svelte/icons/repeat';
	import IconQuote from '@tabler/icons-svelte/icons/quote';
	import { getRelayHint, rxNostr, seenOn } from '$lib/timelines/MainTimeline';

	export let event: Event;
	export let iconSize: number;

	$: reposted = $repostedEventIds.has(event.id);

	async function repost(targetEvent: Event): Promise<void> {
		if ($rom) {
			console.error('Readonly');
			return;
		}

		if (reposted) {
			if (!confirm($_('actions.repost.again'))) {
				return;
			}
		}

		const eTag = ['e', targetEvent.id];
		const relay = getRelayHint(targetEvent.id);
		if (relay) {
			eTag.push(relay);
		}

		const repostEvent = await Signer.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: 6,
			tags: [eTag, ['p', targetEvent.pubkey]],
			content: ''
		});
		console.log(repostEvent, seenOn.get(targetEvent.id));

		rxNostr.send(repostEvent);
		updateRepostedEvents([repostEvent]);
	}

	function quote(event: Event): void {
		$quotes.push(event);
		$openNoteDialog = true;
	}
</script>

<Menu placement="center">
	<svelte:fragment slot="control">
		<div
			class="repost"
			class:hidden={event.kind === Kind.EncryptedDirectMessage}
			class:reposted
		>
			<IconRepeat size={iconSize} />
		</div>
	</svelte:fragment>

	<Menu.Item icon={IconRepeat} on:click={() => repost(event)} disabled={event.kind !== 1}>
		{$_('actions.repost.button')}
	</Menu.Item>
	<Menu.Item icon={IconQuote} on:click={() => quote(event)}>
		{$_('actions.quote.button')}
	</Menu.Item>
</Menu>

<style>
	.repost {
		color: var(--accent-gray);
	}

	.repost.reposted {
		color: var(--green);
	}
</style>
