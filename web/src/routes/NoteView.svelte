<script lang="ts" context="module">
	interface Window {
		// NIP-07
		nostr: any;
	}
	declare var window: Window;
</script>

<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import {
		IconMessageCircle2,
		IconRepeat,
		IconQuote,
		IconHeart,
		IconPaw,
		IconCodeDots
	} from '@tabler/icons-svelte';
	import type { Event } from './types';
	import { pawPad } from '../stores/Preference';
	import { openNoteDialog, quotes, replyTo } from '../stores/NoteDialog';
	import { recommendedRelay, relayUrls } from '../stores/Author';
	import { pool } from '../stores/Pool';
	import { rom } from '../stores/Author';
	import CreatedAt from './CreatedAt.svelte';
	import { Content } from '$lib/Content';
	import Text from './content/Text.svelte';
	import Reference from './content/Reference.svelte';
	import Hashtag from './content/Hashtag.svelte';
	import Url from './content/Url.svelte';
	import { Api } from '$lib/Api';
	import { onMount } from 'svelte';
	export let event: Event;
	export let readonly: boolean;

	if ($rom) {
		readonly = true;
	}

	const iconSize = 20;
	const regexImage = new RegExp('https?://.+\\.(apng|avif|gif|jpg|jpeg|png|webp|bmp)', 'g');
	const regexAudio = new RegExp('https?://.+\\.(mp3|m4a|wav)', 'g');
	const regexVideo = new RegExp('https?://.+\\.(mp4|ogg|webm|ogv|mov|mkv|avi|m4v)', 'g');

	let reposted = false;
	let reactioned = false;
	let jsonDisplay = false;
	let replyToNames: string[] = [];

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

		const event = await window.nostr.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: 6,
			tags: [
				['e', note.id, $recommendedRelay, 'mention'],
				['p', note.pubkey]
			],
			content: ''
		});
		console.log(event);

		$pool.publish($relayUrls, event).on('failed', () => {
			reposted = false;
		});
	}

	function quote(event: Event) {
		$quotes.push(event);
		$openNoteDialog = true;
	}

	async function reaction(note: Event, content = '+') {
		console.log('[reaction]', note);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		reactioned = true;

		if ($pawPad) {
			content = '🐾';
		}

		const event = await window.nostr.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: 7,
			tags: [
				['e', note.id],
				['p', note.pubkey]
			],
			content
		});
		console.log(event);

		$pool.publish($relayUrls, event).on('failed', () => {
			reactioned = false;
		});
	}

	onMount(async () => {
		const pubkeys = Array.from(
			new Set(event.tags.filter(([tagName]) => tagName === 'p').map(([, pubkey]) => pubkey))
		);
		const api = new Api($pool, $relayUrls);
		const promises = pubkeys.map(async (pubkey) => {
			const userEvent = await api.fetchUserEvent(pubkey);
			return (
				userEvent?.user.name ?? nip19.npubEncode(pubkey).substring(0, 'npub1'.length + 7)
			);
		});
		replyToNames = await Promise.all(promises);
	});
</script>

<article id={event.id}>
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
			<div class="name">@{event.user?.name}</div>
			<div class="created_at">
				<a href="/{nip19.noteEncode(event.id)}">
					<CreatedAt createdAt={event.created_at} />
				</a>
			</div>
		</div>
		{#if event.tags.some(([tagName]) => tagName === 'p')}
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
		{:else}
			<p class="content">
				{#each Content.parse(event.content, event.tags) as token}
					{#if token.name === 'reference' && token.index !== undefined && event.tags.at(token.index) !== undefined}
						<Reference text={token.text} tag={event.tags[token.index]} />
					{:else if token.name === 'hashtag'}
						<Hashtag text={token.text} />
					{:else if token.name === 'url'}
						<Url text={token.text} />
					{:else}
						<Text text={token.text} />
					{/if}
				{/each}
			</p>
			<ol class="media">
				{#each [...event.content.matchAll(regexImage)].map((x) => new URL(x[0])) as url}
					<li>
						<a href={url.href} target="_blank" rel="noreferrer">
							<img src={url.href} alt="" />
						</a>
					</li>
				{/each}
			</ol>
			<ol class="media">
				{#each [...event.content.matchAll(regexAudio)].map((x) => new URL(x[0])) as url}
					<li>
						<audio src={url.href} controls />
					</li>
				{/each}
			</ol>
			<ol class="media">
				{#each [...event.content.matchAll(regexVideo)].map((x) => new URL(x[0])) as url}
					<li>
						<!-- svelte-ignore a11y-media-has-caption -->
						<video src={url.href} controls />
					</li>
				{/each}
			</ol>
		{/if}
		{#if event.kind === 42}
			<div>
				<a
					href="https://garnet.nostrian.net/channels/{event.tags
						.find(([tagName, , , marker]) => tagName === 'e' && marker === 'root')
						?.at(1)}"
					target="_blank">Open in GARNET</a
				>
			</div>
		{/if}
		{#if !readonly && event.kind !== 42}
			<div class="action-menu">
				<button on:click={() => reply(event)}>
					<IconMessageCircle2 size={iconSize} />
				</button>
				<button class="repost" disabled={reposted} on:click={() => repost(event)}>
					<IconRepeat size={iconSize} />
				</button>
				<button on:click={() => quote(event)}>
					<IconQuote size={iconSize} />
				</button>
				<button class="reaction" disabled={reactioned} on:click={() => reaction(event)}>
					{#if $pawPad}
						<IconPaw size={iconSize} />
					{:else}
						<IconHeart size={iconSize} />
					{/if}
				</button>
				<button on:click={toggleJsonDisplay}>
					<IconCodeDots size={iconSize} />
				</button>
			</div>
		{/if}
		{#if jsonDisplay}
			<div class="develop">
				<h5>Event JSON</h5>
				<pre><code class="json">{JSON.stringify(event, null, 2)}</code></pre>
				<h5>User JSON</h5>
				<pre><code class="json">{JSON.stringify(event.user, null, 2)}</code></pre>
			</div>
		{/if}
	</div>
</article>

<style>
	article {
		margin: 12px 16px;
		display: flex;
		flex-direction: row;
	}

	.picture {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		margin-right: 12px;
	}

	.note {
		color: rgb(15, 20, 25);
		font-size: 15px;
		font-weight: 400;
		width: 100%;
	}

	.user {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		font-family: 'Segoe UI', Meiryo, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
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

	.content {
		line-height: 20px;
		max-height: 10em;
		overflow: auto;
		margin: 5px 0;
		white-space: pre-wrap;
		word-break: break-all;
		font-family: monospace;
	}

	.media {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
	}

	.media img,
	.media video {
		max-width: 100%;
		max-height: 20em;
		margin: 0.5em;
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

	.repost:disabled {
		color: lightgreen;
	}

	.reaction:disabled {
		color: lightpink;
	}

	.content-warning {
		padding: 0.5em;
		width: 100%;
		height: 5em;
		background-color: lightgray;
	}
</style>
