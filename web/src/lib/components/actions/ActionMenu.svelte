<script lang="ts">
	import type { EventItem, Item } from '$lib/Items';
	import { nip19 } from 'nostr-tools';
	import MenuButton from '../MenuButton.svelte';
	import { metadataStore } from '$lib/cache/Events';
	import { getCodePoints } from '$lib/String';
	import IconMessageCircle from '@tabler/icons-svelte/icons/message-circle';
	import IconBolt from '@tabler/icons-svelte/icons/bolt';
	import RepostButton from '../RepostButton.svelte';
	import ReactionButton from '../ReactionButton.svelte';
	import EmojiPicker from '../EmojiPicker.svelte';
	import ZapDialog from '../ZapDialog.svelte';
	import { sendReaction } from '$lib/author/Reaction';
	import type { Event } from 'nostr-typedef';
	import { notesKinds } from '$lib/Constants';
	import { openNoteDialog, replyTo } from '$lib/stores/NoteDialog';
	import { rom } from '$lib/stores/Author';
	import SeenOnRelays from '../SeenOnRelays.svelte';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';

	interface Props {
		item: EventItem;
	}

	let { item }: Props = $props();

	let zapped = $state(false);
	let jsonDisplay = $state(false);
	let zapDialogComponent = $state<ZapDialog>();

	const iconSize = 20;

	let metadata = $derived($metadataStore.get(item.event.pubkey));
	let nevent = $derived(
		nip19.neventEncode({
			id: item.event.id,
			relays: metadata ? getSeenOnRelays(item.event.id) : undefined,
			author: item.event.pubkey,
			kind: item.event.kind
		})
	);

	function reply() {
		$replyTo = item;
		$openNoteDialog = true;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async function emojiReaction(note: Event, emoji: any) {
		console.log('[reaction with emoji]', note, emoji);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		const content =
			emoji.native ??
			(emoji.shortcodes ? emoji.shortcodes : `:${emoji.id.replaceAll('+', '_')}:`);
		const emojiUrl =
			emoji.native === undefined && emoji.src !== undefined ? emoji.src : undefined;
		sendReaction(note, content, emojiUrl);
	}

	function onZapped() {
		zapped = true;
	}
</script>

<div class="action-menu">
	<button class:hidden={!notesKinds.includes(item.event.kind)} onclick={reply}>
		<IconMessageCircle size={iconSize} />
	</button>
	<RepostButton event={item.event} {iconSize} />
	<ReactionButton event={item.event} {iconSize} />
	<span>
		<EmojiPicker on:pick={({ detail }) => emojiReaction(item.event, detail)} />
	</span>
	<button
		class="zap"
		class:hidden={!metadata?.canZap}
		disabled={zapped}
		onclick={() => zapDialogComponent?.openZapDialog()}
	>
		<IconBolt size={iconSize} />
	</button>
	<ZapDialog
		pubkey={item.event.pubkey}
		event={item.event}
		bind:this={zapDialogComponent}
		on:zapped={onZapped}
	/>
	<MenuButton event={item.event} {iconSize} bind:showDetails={jsonDisplay} />
</div>
{#if jsonDisplay}
	<div class="develop">
		<h5>Event ID</h5>
		<div>{nip19.noteEncode(item.event.id)}</div>
		<br />
		<div>{nevent}</div>
		<h5>Event JSON</h5>
		<code>{JSON.stringify(item.event, null, 2)}</code>
		<h5>User ID</h5>
		<div>{nip19.npubEncode(item.event.pubkey)}</div>
		<h5>User JSON</h5>
		<code>{JSON.stringify(metadata?.content, null, 2)}</code>
		<h5>Code Points</h5>
		<h6>display name</h6>
		<p>
			{getCodePoints(metadata?.content?.display_name ?? '')
				.map((codePoint) => `0x${codePoint.toString(16)}`)
				.join(' ')}
		</p>
		<h6>@name</h6>
		<p>
			{getCodePoints(metadata?.content?.name ?? '')
				.map((codePoint) => `0x${codePoint.toString(16)}`)
				.join(' ')}
		</p>
		<h6>content</h6>
		<p>
			{getCodePoints(item.event.content)
				.map((codePoint) => `0x${codePoint.toString(16)}`)
				.join(' ')}
		</p>
		<SeenOnRelays id={item.event.id} />
		<div>
			Open in <a
				href="https://koteitan.github.io/nostr-post-checker/?hideform&eid={nevent}&kind={item
					.event.kind}"
				target="_blank"
				rel="noopener noreferrer"
			>
				nostr-post-checker
			</a>
		</div>
	</div>
{/if}

<style>
	.develop {
		cursor: default;
		background-color: var(--surface);
	}

	.action-menu {
		display: flex;
		justify-content: space-between;

		margin-top: 8px;
	}

	.action-menu button {
		border: none;
		background-color: inherit;
		cursor: pointer;
		outline: none;
		padding: 0;
		height: 20px;
		color: var(--accent-gray);
	}

	.action-menu button.hidden {
		visibility: hidden;
	}

	.zap:disabled {
		color: #f59f00;
	}
</style>
