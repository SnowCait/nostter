<script lang="ts">
	import { Kind, nip19, type Event } from 'nostr-tools';
	import type { EventItem, Item } from '$lib/Items';
	import { sendReaction } from '$lib/author/Reaction';
	import { metadataStore } from '$lib/cache/Events';
	import IconMessageCircle from '@tabler/icons-svelte/icons/message-circle';
	import IconBolt from '@tabler/icons-svelte/icons/bolt';
	import IconMessages from '@tabler/icons-svelte/icons/messages';
	import { openNoteDialog, replyTo } from '$lib/stores/NoteDialog';
	import { readRelays } from '$lib/stores/Author';
	import { pool } from '$lib/stores/Pool';
	import { rom } from '$lib/stores/Author';
	import { Api } from '$lib/Api';
	import { onMount } from 'svelte';
	import ZapDialog from '../ZapDialog.svelte';
	import Content from '$lib/components/Content.svelte';
	import { getCodePoints } from '$lib/String';
	import { isReply } from '$lib/EventHelper';
	import { Channel, channelIdStore } from '$lib/Channel';
	import EventMetadata from '$lib/components/EventMetadata.svelte';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import MenuButton from '$lib/components/MenuButton.svelte';
	import ReactionButton from '$lib/components/ReactionButton.svelte';
	import RepostButton from '$lib/components/RepostButton.svelte';
	import ProxyLink from '../ProxyLink.svelte';
	import Nip94 from '$lib/components/Nip94.svelte';
	import Via from '../Via.svelte';
	import CreatedAt from '../CreatedAt.svelte';

	export let item: Item;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';
	export let full = false;

	$: eventItem = item as EventItem;
	$: metadata = $metadataStore.get(eventItem.event.pubkey);

	if ($rom) {
		readonly = true;
	}

	const iconSize = 20;

	let zapped = false;
	let jsonDisplay = false;
	let channelId: string | undefined;
	let channelName: string | undefined;
	let zapDialogComponent: ZapDialog;

	let contentWarningTag = item.event.tags.find(([tagName]) => tagName === 'content-warning');
	let showContent = contentWarningTag === undefined;
	const showWarningContent = () => {
		showContent = true;
	};

	function reply(item: Item) {
		$replyTo = item as EventItem;
		$openNoteDialog = true;
	}

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

	onMount(async () => {
		if (item.event.kind === Kind.ChannelMessage) {
			channelId = item.event.tags
				.find(([tagName, , , marker]) => tagName === 'e' && marker === 'root')
				?.at(1);
			if (channelId === undefined) {
				return;
			}
			const api = new Api($pool, $readRelays);
			const channelMetadataEvent = await api.fetchChannelMetadataEvent(channelId);
			if (channelMetadataEvent === undefined) {
				return;
			}
			channelName = Channel.parseMetadata(channelMetadataEvent)?.name;
		}
	});
</script>

<EventMetadata {item} {createdAtFormat}>
	<section slot="content">
		{#if isReply(item.event)}
			<div class="reply">
				<span>To</span>
				<span>
					@{eventItem.replyToPubkeys
						.map((pubkey) => {
							const metadata = $metadataStore.get(pubkey);
							const name = metadata?.content?.name;
							if (name !== undefined && name !== '') {
								return name;
							}
							const displayName = metadata?.content?.display_name;
							if (displayName !== undefined && displayName !== '') {
								return displayName;
							}

							try {
								return nip19.npubEncode(pubkey).substring(0, 'npub1'.length + 7);
							} catch (error) {
								console.error('[npub encode error]', pubkey, error);
								return '-';
							}
						})
						.join(' @')}
				</span>
			</div>
		{/if}
		{#if !showContent}
			<div class="content-warning">
				<div>{contentWarningTag?.at(1) ?? ''}</div>
				<button on:click={showWarningContent}>Show</button>
			</div>
		{:else}
			<div class="content" class:shorten={!full}>
				{#if Number(item.event.kind) === 1063}
					<Nip94 event={item.event} />
				{:else}
					<Content content={item.event.content} tags={item.event.tags} />
				{/if}
			</div>
		{/if}
		{#if item.event.kind === Kind.ChannelMessage && channelId !== undefined && $channelIdStore === undefined}
			<div class="channel">
				<IconMessages size={16} color={'gray'} />
				<span>
					<a href="/channels/{nip19.neventEncode({ id: channelId })}">
						{channelName ?? 'Channel'}
					</a>
				</span>
			</div>
		{/if}
		{#each item.event.tags.filter(([tagName]) => tagName === 'proxy') as tag}
			<div class="proxy"><ProxyLink {tag} /></div>
		{/each}
		{#if !readonly}
			<div class="action-menu">
				<button on:click={() => reply(item)}>
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
					on:click={() => zapDialogComponent.openZapDialog()}
				>
					<IconBolt size={iconSize} />
				</button>
				<ZapDialog
					pubkey={eventItem.event.pubkey}
					event={eventItem.event}
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
					<div>{nip19.neventEncode({ id: item.event.id })}</div>
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
					<div>
						Open in <a
							href="https://koteitan.github.io/nostr-post-checker/?hideform&eid={nip19.neventEncode(
								{ id: item.event.id }
							)}&kind={item.event.kind}"
							target="_blank"
							rel="noopener noreferrer"
						>
							nostr-post-checker
						</a>
					</div>
				</div>
			{/if}
		{/if}
		{#if full}
			<footer>
				<CreatedAt createdAt={item.event.created_at} format="full" />
				<Via tags={item.event.tags} />
			</footer>
		{/if}
	</section>
</EventMetadata>

<style>
	.reply {
		font-size: 0.8em;
		color: gray;
	}

	.content {
		margin: 0.2rem 0 0 0;
		overflow: auto;
	}

	.content.shorten {
		max-height: 30em;
	}

	.develop {
		cursor: default;
		background-color: var(--surface);
	}

	.channel,
	.proxy {
		margin-top: 0.4rem;
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

	.content-warning {
		padding: 0.5em;
		width: 100%;
		height: 5em;
		background-color: lightgray;
	}

	footer {
		margin-top: 0.2rem;
	}
</style>
