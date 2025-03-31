<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Kind } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { reactionedEventIds } from '$lib/author/Action';
	import { sendReaction } from '$lib/author/Reaction';
	import { preferencesStore } from '$lib/Preferences';
	import { rom } from '$lib/stores/Author';
	import IconHeart from '@tabler/icons-svelte/icons/heart';
	import IconHeartFilled from '@tabler/icons-svelte/icons/heart-filled';
	import IconPaw from '@tabler/icons-svelte/icons/paw';
	import IconPawFilled from '@tabler/icons-svelte/icons/paw-filled';
	import IconStar from '@tabler/icons-svelte/icons/star';
	import IconStarFilled from '@tabler/icons-svelte/icons/star-filled';
	import { isAprilFool } from '$lib/Helper';

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

		sendReaction(
			note,
			$preferencesStore.reactionEmoji.content,
			$preferencesStore.reactionEmoji.url
		);
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
	{#if $preferencesStore.reactionEmoji.content === '🐾' || isAprilFool}
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
