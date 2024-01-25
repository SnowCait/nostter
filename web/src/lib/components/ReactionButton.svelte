<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Kind } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { reactionedEventIds, updateReactionedEvents } from '$lib/author/Action';
	import { preferencesStore } from '$lib/Preferences';
	import { rom, writeRelays } from '../../stores/Author';
	import IconHeart from '@tabler/icons-svelte/dist/svelte/icons/IconHeart.svelte';
	import IconHeartFilled from '@tabler/icons-svelte/dist/svelte/icons/IconHeartFilled.svelte';
	import IconPaw from '@tabler/icons-svelte/dist/svelte/icons/IconPaw.svelte';
	import IconPawFilled from '@tabler/icons-svelte/dist/svelte/icons/IconPawFilled.svelte';
	import IconStar from '@tabler/icons-svelte/dist/svelte/icons/IconStar.svelte';
	import IconStarFilled from '@tabler/icons-svelte/dist/svelte/icons/IconStarFilled.svelte';
	import { Signer } from '$lib/Signer';
	import { pool } from '../../stores/Pool';

	export let event: Event;
	export let iconSize: number;

	$: reactioned = $reactionedEventIds.has(event.id);

	async function reaction(note: Event) {
		console.log('[reaction]', note);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		if (reactioned) {
			if (!confirm($_('actions.reaction.again'))) {
				return;
			}
		}

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

		$pool.publish($writeRelays, event);
		updateReactionedEvents([event]);
	}
</script>

<button
	class="clear"
	class:hidden={event.kind === Kind.EncryptedDirectMessage}
	class:paw-pad={$preferencesStore.reactionEmoji.content === '🐾'}
	class:star={$preferencesStore.reactionEmoji.content === '⭐'}
	class:reactioned
	on:click={() => reaction(event)}
>
	{#if $preferencesStore.reactionEmoji.content === '🐾'}
		{#if reactioned}
			<IconPawFilled size={iconSize} />
		{:else}
			<IconPaw size={iconSize} />
		{/if}
	{:else if $preferencesStore.reactionEmoji.content === '⭐'}
		{#if reactioned}
			<IconStarFilled size={iconSize} />
		{:else}
			<IconStar size={iconSize} />
		{/if}
	{:else if reactioned}
		<IconHeartFilled size={iconSize} />
	{:else}
		<IconHeart size={iconSize} />
	{/if}
</button>

<style>
	button {
		color: var(--accent-gray);
	}

	button.reactioned {
		color: var(--pink);
	}

	button.paw-pad.reactioned {
		color: var(--orange);
	}

	button.star.reactioned {
		color: var(--gold);
	}
</style>
