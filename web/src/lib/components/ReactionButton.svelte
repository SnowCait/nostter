<script lang="ts">
	import { Kind } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { preferencesStore } from '$lib/Preferences';
	import { rom, writeRelays } from '../../stores/Author';
	import IconHeart from '@tabler/icons-svelte/dist/svelte/icons/IconHeart.svelte';
	import IconPaw from '@tabler/icons-svelte/dist/svelte/icons/IconPaw.svelte';
	import IconStar from '@tabler/icons-svelte/dist/svelte/icons/IconStar.svelte';
	import { Signer } from '$lib/Signer';
	import { pool } from '../../stores/Pool';

	export let event: Event;
	export let iconSize: number;

	let reactioned = false;

	async function reaction(note: Event) {
		console.log('[reaction]', note);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		reactioned = true;

		const content = $preferencesStore.reactionEmoji.content;
		const tags = note.tags.filter(
			([tagName, p]) => tagName === 'e' || (tagName === 'p' && p !== note.pubkey)
		);
		tags.push(['e', note.id]);
		tags.push(['p', note.pubkey]);
		tags.push(['k', String(note.kind)]);
		if ($preferencesStore.reactionEmoji.url !== undefined) {
			tags.push(['emoji', content.replaceAll(':', ''), $preferencesStore.reactionEmoji.url]);
		}

		const event = await Signer.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: 7,
			tags,
			content
		});
		console.log(event);

		$pool.publish($writeRelays, event).on('failed', () => {
			reactioned = false;
		});
	}
</script>

<button
	class="clear"
	class:hidden={event.kind === Kind.EncryptedDirectMessage}
	class:paw-pad={$preferencesStore.reactionEmoji.content === '🐾'}
	class:star={$preferencesStore.reactionEmoji.content === '⭐'}
	disabled={reactioned}
	on:click={() => reaction(event)}
>
	{#if $preferencesStore.reactionEmoji.content === '🐾'}
		<IconPaw size={iconSize} />
	{:else if $preferencesStore.reactionEmoji.content === '⭐'}
		<IconStar size={iconSize} />
	{:else}
		<IconHeart size={iconSize} />
	{/if}
</button>

<style>
	button {
		color: var(--accent-gray);
	}

	button:disabled {
		color: lightpink;
	}

	button.paw-pad:disabled {
		color: orange;
	}

	button.star:disabled {
		color: gold;
	}
</style>
