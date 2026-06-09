<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { kinds as Kind } from 'nostr-tools';
	import type * as Nostr from 'nostr-typedef';
	import { reactionedEvents } from '$lib/author/Action';
	import { deleteReaction, sendReaction } from '$lib/author/Reaction';
	import { preferencesStore } from '$lib/Preferences';
	import { rom } from '$lib/stores/Author';
	import { isAprilFool } from '$lib/Helper';
	import { createDropdownMenu, melt } from '@melt-ui/svelte';
	import ReactionIcon from './ReactionIcon.svelte';
	import { IconTrash } from '@tabler/icons-svelte-runes';

	interface Props {
		event: Nostr.Event;
		iconSize: number;
	}

	let { event, iconSize }: Props = $props();

	const {
		elements: { menu, item, trigger, overlay, separator }
	} = createDropdownMenu({ preventScroll: false });

	let reactioned = $derived(
		$reactionedEvents.has(event.id) && $reactionedEvents.get(event.id)!.length > 0
	);

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

<div class="reaction">
	<button
		class="clear"
		class:paw-pad={$preferencesStore.reactionEmoji.content === '🐾'}
		class:star={$preferencesStore.reactionEmoji.content === '⭐'}
		class:reactioned
		class:hidden={event.kind === Kind.EncryptedDirectMessage}
		class:display-none={!reactioned}
		use:melt={$trigger}
	>
		<ReactionIcon
			defaultReaction={$preferencesStore.reactionEmoji.content}
			reactioned={true}
			{isAprilFool}
			size={iconSize}
		/>
	</button>
	<button
		class="clear"
		class:paw-pad={$preferencesStore.reactionEmoji.content === '🐾'}
		class:star={$preferencesStore.reactionEmoji.content === '⭐'}
		class:reactioned
		class:hidden={event.kind === Kind.EncryptedDirectMessage}
		class:display-none={reactioned}
		onclick={onReaction}
	>
		<ReactionIcon
			defaultReaction={$preferencesStore.reactionEmoji.content}
			reactioned={false}
			{isAprilFool}
			size={iconSize}
		/>
	</button>
	<div use:melt={$overlay} class="overlay" class:display-none={!reactioned}></div>
	<div use:melt={$menu} class="menu" class:display-none={!reactioned}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div use:melt={$item} onclick={onReaction} class="item">
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
		<div use:melt={$separator} class="separator"></div>
		<div class="text">{$_('menu.caution')}</div>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div use:melt={$item} onclick={onDelete} class="item">
			<div class="icon"><IconTrash size={iconSize} /></div>
			<div>{$_('actions.reaction.undo')}</div>
		</div>
	</div>
</div>

<style>
	.reaction {
		display: flex;
		align-items: center;
	}

	.hidden {
		visibility: hidden;
	}

	.display-none {
		display: none;
	}

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
