<script lang="ts">
	import { run } from 'svelte/legacy';

	import { nip19, type Event } from 'nostr-tools';
	import { cachedEvents, channelMetadataEventsStore, eventItemStore } from '$lib/cache/Events';
	import type { ChannelMetadata } from '$lib/Types';
	import type { Item } from '$lib/Items';
	import IconCodeDots from '@tabler/icons-svelte/icons/code-dots';
	import IconQuote from '@tabler/icons-svelte/icons/quote';
	import { intentContent, openNoteDialog } from '$lib/stores/NoteDialog';
	import { Channel } from '$lib/Channel';
	import { findChannelId } from '$lib/EventHelper';
	import OnelineProfile from '../profile/OnelineProfile.svelte';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import SeenOnRelays from '../SeenOnRelays.svelte';

	interface Props {
		item: Item;
	}

	let { item }: Props = $props();

	const { event } = item;

	let channelId = $derived(event.kind === 40 ? event.id : findChannelId(event.tags));
	let nevent = $derived(nip19.neventEncode({
		id: event.id,
		relays: getSeenOnRelays(event.id),
		author: event.pubkey,
		kind: event.kind
	}));

	let channelMetadataEvent: Event | undefined = $state();
	let channelMetadata: ChannelMetadata | undefined = $state();

	run(() => {
		if (channelId !== undefined) {
			channelMetadataEvent =
				$channelMetadataEventsStore.get(channelId) ??
				cachedEvents.get(channelId) ??
				$eventItemStore.get(channelId)?.event ??
				event;
		}
	});

	run(() => {
		if (channelMetadataEvent !== undefined) {
			channelMetadata = Channel.parseMetadata(channelMetadataEvent);
			console.log('[channel metadata]', channelMetadata, event);
		}
	});

	const iconSize = 20;
	let jsonDisplay = $state(false);

	function quote(): void {
		$intentContent = '\n' + nevent;
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
						id: event.kind === 40 ? event.id : (findChannelId(event.tags) ?? '')
					})}"
				>
					{channelMetadata?.name ?? ''}
				</a>
			</h1>
			{#if channelMetadata?.about !== undefined}
				<p class="about">{channelMetadata.about}</p>
			{/if}
			<div class="profile">
				<span>by</span>
				<a href="/{nip19.npubEncode(item.event.pubkey)}">
					<OnelineProfile pubkey={item.event.pubkey} />
				</a>
			</div>
			<div class="action-menu">
				<button onclick={quote}>
					<IconQuote size={iconSize} />
				</button>
				<button onclick={toggleJsonDisplay}>
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
			<div>{nevent}</div>
			<h5>Event JSON</h5>
			<code>{JSON.stringify(event, null, 2)}</code>
			<SeenOnRelays id={event.id} />
			<div>
				Open in <a
					href="https://koteitan.github.io/nostr-post-checker/?hideform&eid={nevent}&kind={event.kind}"
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
		font-size: 1.5rem;
	}

	p {
		margin: 1rem auto;
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

	.profile {
		margin: 0.5rem auto;
	}

	.profile a {
		text-decoration: none;
	}
</style>
