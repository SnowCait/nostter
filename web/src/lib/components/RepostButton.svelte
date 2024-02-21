<script lang="ts">
	import { Menu } from '@svelteuidev/core';
	import { _ } from 'svelte-i18n';
	import { Kind } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { repostedEventIds, updateRepostedEvents } from '$lib/author/Action';
	import { Signer } from '$lib/Signer';
	import { rom, writeRelays } from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import { openNoteDialog, quotes } from '../../stores/NoteDialog';
	import IconRepeat from '@tabler/icons-svelte/dist/svelte/icons/IconRepeat.svelte';
	import IconQuote from '@tabler/icons-svelte/dist/svelte/icons/IconQuote.svelte';

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

		const repostEvent = await Signer.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: 6 as Kind,
			tags: [
				['e', targetEvent.id, '', 'mention'],
				['p', targetEvent.pubkey]
			],
			content: ''
		});
		console.log(repostEvent);

		$pool.publish($writeRelays, repostEvent);
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

	<Menu.Item icon={IconRepeat} on:click={() => repost(event)} disabled={event.kind === 42}>
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

	:global(.svelteui-Menu-body) {
		padding: 0;
		width: 8rem;
	}
</style>
