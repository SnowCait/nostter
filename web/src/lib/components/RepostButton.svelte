<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Kind } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { repostedEventIds, updateRepostedEvents } from '$lib/author/Action';
	import { Signer } from '$lib/Signer';
	import { rom, writeRelays } from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import IconRepeat from '@tabler/icons-svelte/dist/svelte/icons/IconRepeat.svelte';

	export let event: Event;
	export let iconSize: number;

	$: reposted = $repostedEventIds.has(event.id);

	async function repost(targetEvent: Event) {
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
</script>

<button
	class="clear"
	class:hidden={event.kind === 42 || event.kind === Kind.EncryptedDirectMessage}
	class:reposted
	on:click={() => repost(event)}
>
	<IconRepeat size={iconSize} />
</button>

<style>
	button {
		color: var(--accent-gray);
	}

	button.reposted {
		color: var(--green);
	}
</style>
