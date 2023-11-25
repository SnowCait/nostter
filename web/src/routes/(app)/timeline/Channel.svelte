<script lang="ts">
	import { nip19, type Event } from 'nostr-tools';
	import { cachedEvents, channelMetadataEventsStore, eventItemStore } from '$lib/cache/Events';
	import type { ChannelMetadata } from '$lib/Types';
	import type { Item } from '$lib/Items';
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';
	import IconQuote from '@tabler/icons-svelte/dist/svelte/icons/IconQuote.svelte';
	import { intentContent, openNoteDialog } from '../../../stores/NoteDialog';
	import { Channel } from '$lib/Channel';
	import { findChannelId } from '$lib/EventHelper';

	export let item: Item;

	$: event = item.event;
	$: channelId = event.kind === 40 ? event.id : findChannelId(event.tags);

	let channelMetadataEvent: Event | undefined;
	let channelMetadata: ChannelMetadata | undefined;

	$: if (channelId !== undefined) {
		channelMetadataEvent =
			$channelMetadataEventsStore.get(channelId) ??
			cachedEvents.get(channelId) ??
			$eventItemStore.get(channelId)?.event;
	}

	$: if (channelMetadataEvent !== undefined) {
		channelMetadata = Channel.parseMetadata(channelMetadataEvent);
		console.log('[channel metadata]', channelMetadata, event);
	}

	const iconSize = 20;
	let jsonDisplay = false;

	function quote(event: Event) {
		$intentContent = '\n' + nip19.neventEncode({ id: event.id });
		$openNoteDialog = true;
	}

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};
</script>

<article class="timeline-item">
	<main>
		{#if channelMetadata?.picture !== undefined}
			<img src={channelMetadata.picture} alt="" />
		{/if}
		<div class="channel">
			<h1>
				<a
					href="/channels/{nip19.neventEncode({
						id: event.kind === 40 ? event.id : findChannelId(event.tags) ?? ''
					})}"
				>
					{channelMetadata?.name ?? ''}
				</a>
			</h1>
			{#if channelMetadata?.about !== undefined}
				<p class="about">{channelMetadata.about}</p>
			{/if}
			<div class="action-menu">
				<button on:click={() => quote(event)}>
					<IconQuote size={iconSize} />
				</button>
				<button on:click={toggleJsonDisplay}>
					<IconCodeDots size={iconSize} />
				</button>
			</div>
		</div>
	</main>
	{#if jsonDisplay}
		<div class="develop">
			<h5>Event ID</h5>
			<div>{nip19.noteEncode(event.id)}</div>
			<br />
			<div>{nip19.neventEncode({ id: event.id })}</div>
			<h5>ID</h5>
			<div>{nip19.neventEncode({ id: event.id })}</div>
			<h5>Event JSON</h5>
			<pre><code class="json">{JSON.stringify(event, null, 2)}</code></pre>
			<div>
				Open in <a
					href="https://koteitan.github.io/nostr-post-checker/?eid={nip19.neventEncode({
						id: event.id
					})}&kind={event.kind}"
					target="_blank"
					rel="noopener noreferrer"
				>
					nostr-post-checker
				</a>
			</div>
		</div>
	{/if}
</article>

<style>
	article {
		/* Workaround for unnecessary space */
		display: flex;
		flex-direction: column;
	}

	article.timeline-item {
		padding: 0;
	}

	main {
		display: flex;
		width: 100%;
	}

	img {
		width: 30%;
		object-fit: cover;
	}

	h1 {
		margin-top: 0;
	}

	.channel {
		margin: 1em;
		width: 100%;
	}

	.action-menu {
		display: flex;
		justify-content: space-between;
		margin-top: 12px;
		margin-left: 50%;
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

	.develop pre {
		background-color: #f6f8fa;
		padding: 0.5em;
		overflow: auto;
	}

	.develop .json {
		font-size: 0.8em;
	}
</style>
