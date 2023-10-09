<script lang="ts">
	import { Kind, nip19, type Event } from 'nostr-tools';
	import { Metadata, type EventItem, type Item } from '$lib/Items';
	import { metadataEvents } from '$lib/cache/Events';
	import IconMessageCircle2 from '@tabler/icons-svelte/dist/svelte/icons/IconMessageCircle2.svelte';
	import IconRepeat from '@tabler/icons-svelte/dist/svelte/icons/IconRepeat.svelte';
	import IconQuote from '@tabler/icons-svelte/dist/svelte/icons/IconQuote.svelte';
	import IconHeart from '@tabler/icons-svelte/dist/svelte/icons/IconHeart.svelte';
	import IconPaw from '@tabler/icons-svelte/dist/svelte/icons/IconPaw.svelte';
	import IconStar from '@tabler/icons-svelte/dist/svelte/icons/IconStar.svelte';
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';
	import IconBolt from '@tabler/icons-svelte/dist/svelte/icons/IconBolt.svelte';
	import IconBookmark from '@tabler/icons-svelte/dist/svelte/icons/IconBookmark.svelte';
	import IconMessages from '@tabler/icons-svelte/dist/svelte/icons/IconMessages.svelte';
	import IconDots from '@tabler/icons-svelte/dist/svelte/icons/IconDots.svelte';
	import type { User } from '../types';
	import { reactionEmoji } from '../../stores/Preference';
	import { openNoteDialog, quotes, replyTo } from '../../stores/NoteDialog';
	import { readRelays, writeRelays, pubkey, isBookmarked, author } from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import { rom } from '../../stores/Author';
	import CreatedAt from '../CreatedAt.svelte';
	import { Api } from '$lib/Api';
	import { onMount } from 'svelte';
	import ZapDialog from '../ZapDialog.svelte';
	import Content from '../content/Content.svelte';
	import { Signer } from '$lib/Signer';
	import { getCodePoints } from '$lib/String';
	import { isReply } from '$lib/EventHelper';
	import UserStatus from '../parts/UserStatus.svelte';
	import { Channel, channelIdStore } from '$lib/Channel';
	import EmojiPicker from '../parts/EmojiPicker.svelte';
	import ProxyLink from '../parts/ProxyLink.svelte';

	export let item: Item;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';
	export let full = false;

	$: eventItem = item as EventItem;
	$: metadata = eventItem.metadata;

	if ($rom) {
		readonly = true;
	}

	const iconSize = 20;

	let reposted = false;
	let reactioned = false;
	let bookmarked = isBookmarked(item.event);
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

	async function repost(note: Event) {
		if ($rom) {
			console.error('Readonly');
			return;
		}

		reposted = true;

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

	function quote(event: Event) {
		$quotes.push({
			...event,
			user: metadata?.content as User
		});
		$openNoteDialog = true;
	}

	async function reaction(note: Event) {
		console.log('[reaction]', note);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		reactioned = true;

		const content = $reactionEmoji;

		const event = await Signer.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: 7,
			tags: [
				['e', note.id],
				['p', note.pubkey]
			],
			content
		});
		console.log(event);

		$pool.publish($writeRelays, event).on('failed', () => {
			reactioned = false;
		});
	}

	async function emojiReaction(note: Event, emoji: any) {
		console.log('[emoji reaction]', note, emoji);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		const tags = [
			['e', note.id],
			['p', note.pubkey]
		];
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

	async function bookmark(note: Event) {
		console.log('[bookmark]', note, $rom);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		if (bookmarked) {
			console.debug('[bookmark already]');
			return;
		}

		bookmarked = true;

		const api = new Api($pool, $writeRelays);
		const latestEvent = await api.fetchBookmarkEvent($pubkey);
		console.log('[bookmark latest]', latestEvent);
		if (
			latestEvent !== undefined &&
			latestEvent.tags.some(([tagName, id]) => tagName === 'e' && id === note.id)
		) {
			console.log('[bookmark already]', note);
			return;
		}

		api.signAndPublish(30001 as Kind, latestEvent?.content ?? '', [
			...(latestEvent?.tags ?? [['d', 'bookmark']]),
			['e', note.id]
		]).catch((error) => {
			console.error('[bookmark failed]', error);
			bookmarked = false;
			alert('Failed to bookmark');
		});
	}

	async function removeBookmark(note: Event) {
		console.log('[bookmark]', note, $rom);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		if (!bookmarked) {
			console.debug('[not bookmarked]');
			return;
		}

		if (!confirm('Remove bookmark?')) {
			return;
		}

		bookmarked = false;

		const api = new Api($pool, $writeRelays);
		const latestEvent = await api.fetchBookmarkEvent($pubkey);
		console.log('[bookmark latest]', latestEvent);
		if (
			latestEvent === undefined ||
			!latestEvent.tags.some(([tagName, id]) => tagName === 'e' && id === note.id)
		) {
			console.log('[bookmark removed already]', note);
			return;
		}

		api.signAndPublish(
			30001 as Kind,
			latestEvent.content,
			latestEvent.tags.filter(([tagName, id]) => !(tagName === 'e' && id === note.id))
		).catch((error) => {
			console.error('[remove bookmark failed]', error);
			bookmarked = true;
			alert('Failed to remove bookmark');
		});
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

<article class="timeline-item">
	<ZapDialog {eventItem} bind:this={zapDialogComponent} on:zapped={onZapped} />
	<div>
		<a href="/{nip19.npubEncode(item.event.pubkey)}">
			<img class="picture" src={metadata?.content?.picture} alt="" />
		</a>
	</div>
	<div class="note">
		<div class="user">
			<div class="display_name">
				{metadata?.content?.display_name
					? metadata?.content.display_name
					: metadata?.content?.name}
			</div>
			<div class="name">
				@{metadata?.content?.name
					? metadata?.content.name
					: metadata?.content?.display_name}
			</div>
			<div class="created_at">
				<CreatedAt createdAt={item.event.created_at} format={createdAtFormat} />
			</div>
		</div>
		<div class="user-status">
			<UserStatus pubkey={item.event.pubkey} />
		</div>
		{#if isReply(item.event)}
			<div class="reply">
				<span>To</span>
				<span>
					@{eventItem.replyToPubkeys
						.map((pubkey) => {
							const metadataEvent = metadataEvents.get(pubkey);
							if (metadataEvent === undefined) {
								return nip19.npubEncode(pubkey).substring(0, 'npub1'.length + 7);
							}
							const metadata = new Metadata(metadataEvent);
							const name = metadata?.content?.name;
							if (name !== undefined && name !== '') {
								return name;
							}
							const displayName = metadata?.content?.display_name;
							if (displayName !== undefined && displayName !== '') {
								return displayName;
							}
							return nip19.npubEncode(pubkey).substring(0, 'npub1'.length + 7);
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
			<div class="content">
				<Content content={item.event.content} tags={item.event.tags} />
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
				<button
					class="repost"
					class:hidden={item.event.kind === 42 ||
						item.event.kind === Kind.EncryptedDirectMessage}
					disabled={reposted}
					on:click={() => repost(item.event)}
				>
					<IconRepeat size={iconSize} />
				</button>
				<button
					class:hidden={item.event.kind === Kind.EncryptedDirectMessage}
					on:click={() => quote(item.event)}
				>
					<IconQuote size={iconSize} />
				</button>
				<button
					class="reaction"
					class:hidden={item.event.kind === Kind.EncryptedDirectMessage}
					class:paw-pad={$reactionEmoji === '🐾'}
					class:star={$reactionEmoji === '⭐'}
					disabled={reactioned}
					on:click={() => reaction(item.event)}
				>
					{#if $reactionEmoji === '🐾'}
						<IconPaw size={iconSize} />
					{:else if $reactionEmoji === '⭐'}
						<IconStar size={iconSize} />
					{:else}
						<IconHeart size={iconSize} />
					{/if}
				</button>
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
					<button
						class="bookmark"
						class:hidden={!(
							item.event.kind === Kind.Text || item.event.kind === Kind.ChannelMessage
						)}
						class:bookmarked
						on:click={() => bookmark(item.event)}
						on:dblclick={() => removeBookmark(item.event)}
					>
						<IconBookmark size={iconSize} />
					</button>
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
						<pre><code class="json">{JSON.stringify(item.event, null, 2)}</code></pre>
						<h5>User ID</h5>
						<div>{nip19.npubEncode(item.event.pubkey)}</div>
						<h5>User JSON</h5>
						<pre><code class="json"
								>{JSON.stringify(metadata?.event ?? '{}', null, 2)}</code
							></pre>
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
								href="https://koteitan.github.io/nostr-post-checker/?eid={nip19.neventEncode(
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
	</div>
</article>

<style>
	article {
		display: flex;
		flex-direction: row;
	}

	.picture {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		margin-right: 12px;
		object-fit: cover;
	}

	.note {
		color: rgb(15, 20, 25);
		font-size: 15px;
		font-weight: 400;
		width: calc(100% - 60px);

		/* Workaround for unnecessary space */
		display: flex;
		flex-direction: column;
	}

	.user {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
	}

	.display_name {
		margin-right: 4px;
		font-weight: 700;
	}

	.name {
		color: rgb(83, 100, 113);
		font-size: 15px;
	}

	.display_name,
	.name {
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}

	.created_at {
		margin-left: auto;
	}

	.reply {
		font-size: 0.8em;
		color: gray;
	}

	.direct-message {
		margin: 0.1rem 0;
	}

	.content {
		margin: 0.2rem 0 0 0;
		max-height: 30em;
		overflow: auto;
	}

	.develop {
		cursor: default;
		background-color: var(--surface);
	}

	.develop pre {
		background-color: #f6f8fa;
		padding: 0.5em;
		overflow: auto;
	}
	.develop .json {
		font-size: 0.8em;
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

	.repost:disabled {
		color: lightgreen;
	}

	.reaction:disabled {
		color: lightpink;
	}

	.reaction.paw-pad:disabled {
		color: orange;
	}

	.reaction.star:disabled {
		color: gold;
	}

	.bookmark.bookmarked {
		color: crimson;
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
