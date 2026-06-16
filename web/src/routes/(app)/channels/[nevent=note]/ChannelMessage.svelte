<script lang="ts">
	import type * as Nostr from 'nostr-typedef';
	import type { Event } from 'nostr-tools';
	import { npubEncode } from 'nostr-tools/nip19';
	import { _ } from 'svelte-i18n';
	import { IconMessageCircle, IconBolt } from '@tabler/icons-svelte-runes';
	import { metadataStore } from '$lib/cache/Events';
	import { alternativeName, EventItem } from '$lib/Items';
	import { author, rom } from '$lib/stores/Author';
	import { sendReaction } from '$lib/author/Reaction';
	import Content from '$lib/components/Content.svelte';
	import CreatedAt from '$lib/components/CreatedAt.svelte';
	import ProfileIcon from '$lib/components/profile/ProfileIcon.svelte';
	import ReactionButton from '$lib/components/ReactionButton.svelte';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import ZapDialog from '$lib/components/ZapDialog.svelte';

	interface Props {
		event: Event;
		compact?: boolean;
		selected?: boolean;
		onReply?: (event: Event) => void;
		onSelect?: (id: string) => void;
	}

	let { event, compact = false, selected = false, onReply, onSelect }: Props = $props();

	let metadata = $derived($metadataStore.get(event.pubkey));
	let name = $derived(metadata?.displayName || alternativeName(event.pubkey));
	let npub = $derived(npubEncode(event.pubkey));
	let eventItem = $derived(new EventItem(event));

	let zapDialog = $state<ZapDialog>();

	function onMessageClick(e: MouseEvent): void {
		const target = e.target as HTMLElement | null;
		if (target?.closest('a, button, .actions') !== null) {
			return;
		}
		onSelect?.(event.id);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function emojiReaction(emoji: any): void {
		if ($rom) {
			return;
		}
		const content =
			emoji.native ??
			(emoji.shortcodes ? emoji.shortcodes : `:${emoji.id.replaceAll('+', '_')}:`);
		const url = emoji.native === undefined && emoji.src !== undefined ? emoji.src : undefined;
		sendReaction(event as Nostr.Event, content, url);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="message" class:compact class:selected onclick={onMessageClick}>
	<div class="left">
		{#if compact}
			<div class="timestamp"><CreatedAt createdAt={event.created_at} format="time" /></div>
		{:else}
			<a href="/{npub}"><ProfileIcon pubkey={event.pubkey} width="40px" height="40px" /></a>
		{/if}
	</div>
	<div class="body">
		{#if !compact}
			<div class="head">
				<a class="name" href="/{npub}">{name}</a>
				<CreatedAt createdAt={event.created_at} format="auto" />
			</div>
		{/if}
		<div class="content">
			<Content content={event.content} tags={event.tags} {event} />
		</div>
	</div>
	{#if $author !== undefined}
		<div class="actions">
			{#if onReply !== undefined}
				<button
					class="clear"
					title={$_('actions.reply.button')}
					onclick={() => onReply?.(event)}
				>
					<IconMessageCircle size={20} />
				</button>
			{/if}
			<ReactionButton {event} iconSize={20} />
			<span class="emoji">
				<EmojiPicker on:pick={({ detail }) => emojiReaction(detail)} />
			</span>
			<button
				class="clear"
				class:hidden={!metadata?.canZap}
				onclick={() => zapDialog?.openZapDialog()}
			>
				<IconBolt size={20} />
			</button>
		</div>
		<ZapDialog pubkey={event.pubkey} item={eventItem} bind:this={zapDialog} />
	{/if}
</div>

<style>
	.message {
		display: flex;
		flex-direction: row;
		gap: 12px;
		padding: 0.3rem 1rem;
		position: relative;
	}

	.message:hover {
		background: var(--accent-surface-low);
	}

	.left {
		width: 40px;
		flex-shrink: 0;
		display: flex;
		justify-content: center;
	}

	.compact .timestamp {
		visibility: hidden;
		font-size: 0.6rem;
		line-height: 1.4;
		white-space: nowrap;
	}

	.compact:hover .timestamp,
	.compact.selected .timestamp {
		visibility: visible;
	}

	.body {
		min-width: 0;
		flex: 1;
	}

	.head {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		gap: 0.4rem;
	}

	.name {
		font-weight: 700;
		color: var(--foreground);
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}

	.content {
		min-width: 0;
	}

	.actions {
		display: none;
		align-items: center;
		gap: 0.25rem;
		position: absolute;
		top: 0;
		right: 0.75rem;
		transform: translateY(-50%);
		padding: 0.2rem 0.4rem;
		background: var(--accent-surface-low);
		border-radius: var(--radius);
	}

	.message:hover .actions,
	.message.selected .actions,
	.actions:has(:global([data-melt-popover-content][data-open])) {
		display: flex;
	}

	.actions > span {
		display: flex;
		align-items: center;
	}

	.actions :global(button.clear),
	.actions :global(button) {
		padding: 8px;
		color: var(--accent-gray);
	}

	.actions button.hidden {
		display: none;
	}
</style>
