<script lang="ts">
	import { Kind, nip19, type Event } from 'nostr-tools';
	import type { EventItem, Item } from '$lib/Items';
	import { metadataStore } from '$lib/cache/Events';
	import IconMessageCircle2 from '@tabler/icons-svelte/dist/svelte/icons/IconMessageCircle2.svelte';
	import IconQuote from '@tabler/icons-svelte/dist/svelte/icons/IconQuote.svelte';
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';
	import IconBolt from '@tabler/icons-svelte/dist/svelte/icons/IconBolt.svelte';
	import IconMessages from '@tabler/icons-svelte/dist/svelte/icons/IconMessages.svelte';
	import IconDots from '@tabler/icons-svelte/dist/svelte/icons/IconDots.svelte';
	import type { User } from '../../types';
	import { openNoteDialog, quotes, replyTo } from '../../../stores/NoteDialog';
	import { readRelays, writeRelays, pubkey, author } from '../../../stores/Author';
	import { pool } from '../../../stores/Pool';
	import { rom } from '../../../stores/Author';
	import { Api } from '$lib/Api';
	import { onMount } from 'svelte';
	import ZapDialog from '../ZapDialog.svelte';
	import Content from '../content/Content.svelte';
	import { Signer } from '$lib/Signer';
	import { getCodePoints } from '$lib/String';
	import { isReply } from '$lib/EventHelper';
	import { Channel, channelIdStore } from '$lib/Channel';
	import BookmarkButton from '$lib/components/BookmarkButton.svelte';
	import EventMetadata from '$lib/components/EventMetadata.svelte';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import ReactionButton from '$lib/components/ReactionButton.svelte';
	import RepostButton from '$lib/components/RepostButton.svelte';
	import ProxyLink from '../parts/ProxyLink.svelte';
	import Nip94 from '../Nip94.svelte';

	export let item: Item;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';
	export let full = false;

	const eventItem = item as EventItem;

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

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};

	let showMenu = false;

	function reply(item: Item) {
		$replyTo = item as EventItem;
		$openNoteDialog = true;
	}

	function quote(event: Event) {
		$quotes.push({
			...event,
			user: metadata?.content as User
		});
		$openNoteDialog = true;
	}

	async function emojiReaction(note: Event, emoji: any) {
		console.log('[emoji reaction]', note, emoji);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		const tags = note.tags.filter(
			([tagName, p]) => tagName === 'e' || (tagName === 'p' && p !== note.pubkey)
		);
		tags.push(['e', note.id]);
		tags.push(['p', note.pubkey]);
		tags.push(['k', String(note.kind)]);
		if (emoji.native === undefined && emoji.src !== undefined) {
			tags.push(['emoji', emoji.id.replaceAll('+', '_'), emoji.src]);
		}

		const event = await Signer.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: 7,
			tags,
			content:
				emoji.native ??
				(emoji.shortcodes ? emoji.shortcodes : `:${emoji.id.replaceAll('+', '_')}:`)
		});
		console.log(event);

		$pool.publish($writeRelays, event);
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
								console.error('[npub encode error]', pubkey);
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
		{:else if item.event.kind === Kind.EncryptedDirectMessage}
			<p class="direct-message">
				<span>Direct Message.</span>
				{#if $author?.isRelated(item.event) || item.event.pubkey === $pubkey}
					<span>Please open in another app.</span>
				{:else}
					<span>This message is not for you.</span>
				{/if}
			</p>
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
				<button
					class:hidden={item.event.kind === Kind.EncryptedDirectMessage}
					on:click={() => reply(item)}
				>
					<IconMessageCircle2 size={iconSize} />
				</button>
				<RepostButton event={item.event} {iconSize} />
				<button
					class:hidden={item.event.kind === Kind.EncryptedDirectMessage}
					on:click={() => quote(item.event)}
				>
					<IconQuote size={iconSize} />
				</button>
				<ReactionButton event={item.event} {iconSize} />
				<span class:hidden={item.event.kind === Kind.EncryptedDirectMessage}>
					<EmojiPicker on:pick={({ detail }) => emojiReaction(item.event, detail)} />
				</span>
				<button class:hidden={full} on:click={() => (showMenu = !showMenu)}>
					<IconDots size={iconSize} />
				</button>
			</div>
			{#if full || showMenu}
				<div class="action-menu">
					<!-- instead of margin -->
					<button class:hidden={true} on:click={console.debug}>
						<IconDots size={iconSize} />
					</button>
					<button class:hidden={true} on:click={console.debug}>
						<IconDots size={iconSize} />
					</button>
					<button class:hidden={true} on:click={console.debug}>
						<IconDots size={iconSize} />
					</button>
					<!-- /instead of margin -->
					<BookmarkButton event={item.event} {iconSize} />
					<button
						class="zap"
						class:hidden={metadata?.content === undefined ||
							(metadata?.content.lud16 === undefined &&
								metadata?.content.lud06 === undefined) ||
							item.event.kind === Kind.EncryptedDirectMessage}
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
					<button on:click={toggleJsonDisplay}>
						<IconCodeDots size={iconSize} />
					</button>
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
		{/if}
	</section>
</EventMetadata>

<style>
	.reply {
		font-size: 0.8em;
		color: gray;
	}

	.direct-message {
		margin: 0.1rem 0;
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

	.action-menu + .action-menu {
		margin-top: 16px;
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
</style>
