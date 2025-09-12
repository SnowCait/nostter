<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { kinds as Kind } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { reactionedEvents } from '$lib/author/Action';
	import { deleteReaction, sendReaction } from '$lib/author/Reaction';
	import { preferencesStore } from '$lib/Preferences';
	import { rom } from '$lib/stores/Author';
	import { isAprilFool } from '$lib/Helper';
	import { createDropdownMenu, melt } from '@melt-ui/svelte';
	import ReactionIcon from './ReactionIcon.svelte';
	import IconTrash from '@tabler/icons-svelte/icons/trash';

	export let event: Event;
	export let iconSize: number;

	const {
		elements: { menu, item, trigger, overlay }
	} = createDropdownMenu({ preventScroll: false });

	$: reactioned = $reactionedEvents.has(event.id) && $reactionedEvents.get(event.id)!.length > 0;

	async function onReaction(): Promise<void> {
		console.debug('[reaction]', event);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		await sendReaction(
			event,
			$preferencesStore.reactionEmoji.content,
			$preferencesStore.reactionEmoji.url
		);
	}

	function onDelete(): void {
		console.debug('[reaction delete]', event);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		deleteReaction(event);
	}
</script>

{#if reactioned}
	<button
		class="clear"
		class:hidden={event.kind === Kind.EncryptedDirectMessage}
		class:paw-pad={$preferencesStore.reactionEmoji.content === '🐾'}
		class:star={$preferencesStore.reactionEmoji.content === '⭐'}
		class:reactioned
		use:melt={$trigger}
	>
		<ReactionIcon
			defaultReaction={$preferencesStore.reactionEmoji.content}
			{reactioned}
			{isAprilFool}
			size={iconSize}
		/>
	</button>
	<div use:melt={$overlay} class="overlay" />
	<div use:melt={$menu} class="menu">
		<div use:melt={$item} on:m-click={onReaction} class="item">
			<div class="icon">
				<ReactionIcon
					defaultReaction={$preferencesStore.reactionEmoji.content}
					reactioned={false}
					{isAprilFool}
					size={iconSize}
				/>
			</div>
			<div>{$_('actions.reaction.again')}</div>
		</div>
		<div use:melt={$item} on:m-click={onDelete} class="item">
			<div class="icon"><IconTrash size={iconSize} /></div>
			<div>{$_('actions.reaction.delete')}</div>
		</div>
	</div>
{:else}
	<button
		class="clear"
		class:hidden={event.kind === Kind.EncryptedDirectMessage}
		class:paw-pad={$preferencesStore.reactionEmoji.content === '🐾'}
		class:star={$preferencesStore.reactionEmoji.content === '⭐'}
		class:reactioned
		on:click={onReaction}
	>
		<ReactionIcon
			defaultReaction={$preferencesStore.reactionEmoji.content}
			{reactioned}
			{isAprilFool}
			size={iconSize}
		/>
	</button>
{/if}

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

	.overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
	}

	.menu {
		background-color: var(--surface);
		border-radius: 5px;
		display: flex;
		flex-direction: column;
		box-shadow:
			rgba(101, 119, 134, 0.2) 0px 0px 15px,
			rgba(101, 119, 134, 0.15) 0px 0px 3px 1px;
		overflow: hidden;
	}

	.menu .item {
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		display: flex;
		flex-direction: row;
	}

	.menu .item:hover {
		background-color: var(--hover-background-color);
	}

	.menu .item .icon {
		width: 24px;
		height: 24px;
		margin-right: 12px;
		display: flex;
		justify-content: center;
		align-items: center;
	}
</style>
