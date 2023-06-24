<script lang="ts">
	import { Kind, nip19 } from 'nostr-tools';
	import IconMessageCircle2 from '@tabler/icons-svelte/dist/svelte/icons/IconMessageCircle2.svelte';
	import IconRepeat from '@tabler/icons-svelte/dist/svelte/icons/IconRepeat.svelte';
	import IconQuote from '@tabler/icons-svelte/dist/svelte/icons/IconQuote.svelte';
	import IconHeart from '@tabler/icons-svelte/dist/svelte/icons/IconHeart.svelte';
	import IconPaw from '@tabler/icons-svelte/dist/svelte/icons/IconPaw.svelte';
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';
	import IconBolt from '@tabler/icons-svelte/dist/svelte/icons/IconBolt.svelte';
	import IconBookmark from '@tabler/icons-svelte/dist/svelte/icons/IconBookmark.svelte';
	import type { ChannelMetadata, Event } from '../types';
	import { reactionEmoji } from '../../stores/Preference';
	import { openNoteDialog, quotes, replyTo } from '../../stores/NoteDialog';
	import {
		recommendedRelay,
		readRelays,
		writeRelays,
		pubkey,
		isBookmarked
	} from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import { rom } from '../../stores/Author';
	import CreatedAt from '../CreatedAt.svelte';
	import { Api } from '$lib/Api';
	import { onMount } from 'svelte';
	import ZapDialog from '../ZapDialog.svelte';
	import Content from '../content/Content.svelte';
	import { Signer } from '$lib/Signer';
	import { getCodePoints } from '$lib/String';

	export let event: Event;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	if ($rom) {
		readonly = true;
	}

	const iconSize = 20;

	let reposted = false;
	let reactioned = false;
	let bookmarked = isBookmarked(event);
	let zapped = false;
	let jsonDisplay = false;
	let replyToNames: string[] = [];
	let channelId: string | undefined;
	let channelName: string | undefined;
	let channelMetadata: ChannelMetadata | undefined;
	const originalEvent = Object.assign({}, event) as any;
	delete originalEvent.user;
	const originalUser = Object.assign({}, event.user) as any;
	delete originalUser.zapEndpoint;
	let zapDialogComponent: ZapDialog;

	let contentWarning = event.tags.find(([tagName]) => tagName === 'content-warning')?.at(1);
	let showContent = contentWarning === undefined;
	const showWarningContent = () => {
		showContent = true;
	};

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};

	function reply(event: Event) {
		$replyTo = event;
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
				['e', note.id, $recommendedRelay, 'mention'],
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
		$quotes.push(event);
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

		const kind = 30001;
		const created_at = Math.round(Date.now() / 1000);
		const unsignedEvent =
			latestEvent === undefined
				? {
						created_at,
						kind,
						tags: [
							['d', 'bookmark'],
							['e', note.id]
						],
						content: ''
				  }
				: {
						created_at,
						kind,
						tags: [...latestEvent.tags, ['e', note.id]],
						content: latestEvent.content
				  };
		const event = await Signer.signEvent(unsignedEvent);
		console.log('[bookmark new]', event);

		api.publish(event).catch((error) => {
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

		const kind = 30001;
		const created_at = Math.round(Date.now() / 1000);
		const unsignedEvent = {
			created_at,
			kind,
			tags: latestEvent.tags.filter(([tagName, id]) => !(tagName === 'e' && id === note.id)),
			content: latestEvent.content
		};
		const event = await Signer.signEvent(unsignedEvent);
		console.log('[bookmark new]', event);

		api.publish(event).catch((error) => {
			console.error('[remove bookmark failed]', error);
			bookmarked = true;
			alert('Failed to remove bookmark');
		});
	}

	function onZapped() {
		zapped = true;
	}

	onMount(async () => {
		const pubkeys = Array.from(
			new Set(event.tags.filter(([tagName]) => tagName === 'p').map(([, pubkey]) => pubkey))
		);
		const api = new Api($pool, $readRelays);
		const promises = pubkeys.map(async (pubkey) => {
			const userEvent = await api.fetchUserEvent(pubkey);
			return (
				userEvent?.user?.name ?? nip19.npubEncode(pubkey).substring(0, 'npub1'.length + 7)
			);
		});
		replyToNames = await Promise.all(promises);

		if (event.kind === Kind.ChannelMessage) {
			channelId = event.tags
				.find(([tagName, , , marker]) => tagName === 'e' && marker === 'root')
				?.at(1);
			if (channelId === undefined) {
				return;
			}
			const channelMetadataEvent = await api.fetchChannelMetadataEvent(channelId);
			if (channelMetadataEvent === undefined) {
				return;
			}
			channelMetadata = JSON.parse(channelMetadataEvent.content);
			channelName = channelMetadata?.name;
		}
	});
</script>

<article class="timeline-item">
	<ZapDialog {event} bind:this={zapDialogComponent} on:zapped={onZapped} />
	<div>
		<a href="/{nip19.npubEncode(event.pubkey)}">
			<img class="picture" src={event.user?.picture} alt="" />
		</a>
	</div>
	<div class="note">
		<div class="user">
			<div class="display_name">
				{event.user?.display_name ? event.user.display_name : event.user?.name}
			</div>
			<div class="name">
				@{event.user?.name ? event.user.name : event.user?.display_name}
			</div>
			<div class="created_at">
				<a href="/{nip19.noteEncode(event.id)}">
					<CreatedAt createdAt={event.created_at} format={createdAtFormat} />
				</a>
			</div>
		</div>
		{#if event.tags.some(([tagName]) => tagName === 'e') && event.tags.some(([tagName]) => tagName === 'p')}
			<div class="reply">
				<span>To</span>
				<span>@{replyToNames.join(' @')}</span>
			</div>
		{/if}
		{#if !showContent}
			<div class="content-warning">
				<div>{contentWarning}</div>
				<button on:click={showWarningContent}>Show</button>
			</div>
		{:else if event.kind === Kind.EncryptedDirectMessage}
			<p class="direct-message">
				<span>Direct Message.</span>
				<span>Please open in other client.</span>
			</p>
		{:else}
			<Content content={event.content} tags={event.tags} />
		{/if}
		{#if event.kind === Kind.ChannelMessage && channelId !== undefined}
			<div>
				<span>In</span>
				<span>
					<a
						href="https://garnet.nostrian.net/channels/{channelId}"
						target="_blank"
						rel="noopener noreferrer"
					>
						{channelName ?? 'GARNET'}
					</a>
				</span>
			</div>
		{/if}
		{#if !readonly && event.kind !== Kind.EncryptedDirectMessage}
			<div class="action-menu">
				<button class:hidden={event.kind === 42} on:click={() => reply(event)}>
					<IconMessageCircle2 size={iconSize} />
				</button>
				<button
					class="repost"
					class:hidden={event.kind === 42}
					disabled={reposted}
					on:click={() => repost(event)}
				>
					<IconRepeat size={iconSize} />
				</button>
				<button class:hidden={event.kind === 42} on:click={() => quote(event)}>
					<IconQuote size={iconSize} />
				</button>
				<button class="reaction" disabled={reactioned} on:click={() => reaction(event)}>
					{#if $reactionEmoji === '🐾'}
						<IconPaw size={iconSize} />
					{:else}
						<IconHeart size={iconSize} />
					{/if}
				</button>
				<button
					class="bookmark"
					class:hidden={event.kind !== Kind.Text}
					class:bookmarked
					on:click={() => bookmark(event)}
					on:dblclick={() => removeBookmark(event)}
				>
					<IconBookmark size={iconSize} />
				</button>
				<button
					class="zap"
					class:hidden={event.user === undefined || event.user.zapEndpoint === null}
					disabled={zapped}
					on:click={() => zapDialogComponent.openZapDialog()}
				>
					<IconBolt size={iconSize} />
				</button>
				<button on:click={toggleJsonDisplay}>
					<IconCodeDots size={iconSize} />
				</button>
			</div>
		{/if}
		{#if jsonDisplay}
			<div class="develop">
				<h5>Event ID</h5>
				<div>{nip19.noteEncode(event.id)}</div>
				<br />
				<div>{nip19.neventEncode({ id: event.id })}</div>
				<h5>Event JSON</h5>
				<pre><code class="json">{JSON.stringify(originalEvent, null, 2)}</code></pre>
				<h5>User ID</h5>
				<div>{nip19.npubEncode(event.pubkey)}</div>
				<h5>User JSON</h5>
				<pre><code class="json">{JSON.stringify(originalUser, null, 2)}</code></pre>
				<h5>Code Points</h5>
				<h6>display name</h6>
				<p>
					{getCodePoints(event.user?.display_name)
						.map((codePoint) => `0x${codePoint.toString(16)}`)
						.join(' ')}
				</p>
				<h6>@name</h6>
				<p>
					{getCodePoints(event.user?.name)
						.map((codePoint) => `0x${codePoint.toString(16)}`)
						.join(' ')}
				</p>
				<h6>content</h6>
				<p>
					{getCodePoints(event.content)
						.map((codePoint) => `0x${codePoint.toString(16)}`)
						.join(' ')}
				</p>
			</div>
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

	.develop pre {
		background-color: #f6f8fa;
		padding: 0.5em;
		overflow: auto;
	}
	.develop .json {
		font-size: 0.8em;
	}

	.action-menu {
		display: flex;
		justify-content: space-between;
		margin-top: 12px;
	}

	.action-menu button {
		border: none;
		background-color: inherit;
		cursor: pointer;
		outline: none;
		padding: 0;
		color: lightgray;
		height: 20px;
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
