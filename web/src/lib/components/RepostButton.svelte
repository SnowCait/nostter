<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Kind } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { Signer } from '$lib/Signer';
	import { rom, writeRelays } from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import IconRepeat from '@tabler/icons-svelte/dist/svelte/icons/IconRepeat.svelte';

	export let event: Event;
	export let iconSize: number;

	let reposted = false;

	async function repost(note: Event) {
		if ($rom) {
			console.error('Readonly');
			return;
		}

		if (reposted) {
			if (!confirm($_('actions.repost.again'))) {
				return;
			}
		} else {
			reposted = true;
		}

		const event = await Signer.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: 6 as Kind,
			tags: [
				['e', note.id, '', 'mention'],
				['p', note.pubkey]
			],
			content: ''
		});
		console.log(event);

		$pool.publish($writeRelays, event).on('failed', () => {
			reposted = false;
		});
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
