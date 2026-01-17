<script lang="ts">
	import { stopPropagation } from 'svelte/legacy';

	import { nip19, type Event } from 'nostr-tools';
	import { intentContent, openNoteDialog } from '$lib/stores/NoteDialog';
	import IconCodeDots from '@tabler/icons-svelte/icons/code-dots';
	import IconQuote from '@tabler/icons-svelte/icons/quote';
	import SeenOnRelays from '../SeenOnRelays.svelte';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { findIdentifier } from '$lib/EventHelper';

	interface Props {
		event: Event;
	}

	let { event }: Props = $props();

	let title = $derived(event.tags.find(([tagName]) => tagName === 'title')?.at(1));
	let image = $derived(event.tags.find(([tagName]) => tagName === 'image')?.at(1));
	let summary = $derived(event.tags.find(([tagName]) => tagName === 'summary')?.at(1));
	let naddr = $derived(
		nip19.naddrEncode({
			kind: event.kind,
			pubkey: event.pubkey,
			identifier: findIdentifier(event.tags) ?? '',
			relays: getSeenOnRelays(event.id)
		})
	);

	const iconSize = 20;
	let jsonDisplay = $state(false);

	function quote() {
		$intentContent = `\nnostr:${naddr}`;
		$openNoteDialog = true;
	}

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};
</script>

<article class="timeline-item">
	<main>
		{#if image !== undefined}
			<img src={image} alt="" />
		{/if}
		<div class="content">
			<h1>{title ?? '-'}</h1>
			<p>{summary ?? ''}</p>
			<div class="action-menu">
				<button onclick={stopPropagation(quote)}>
					<IconQuote size={iconSize} />
				</button>
				<button onclick={stopPropagation(toggleJsonDisplay)}>
					<IconCodeDots size={iconSize} />
				</button>
			</div>
		</div>
	</main>
	{#if jsonDisplay}
		<div class="develop">
			<h5>ID</h5>
			<div>{naddr}</div>
			<h5>Event JSON</h5>
			<code>{JSON.stringify(event, null, 2)}</code>
			<SeenOnRelays id={event.id} />
			<div>
				Open in <a
					href="https://koteitan.github.io/nostr-post-checker/?hideform&eid={nip19.neventEncode(
						{
							id: event.id,
							relays: getSeenOnRelays(event.id),
							author: event.pubkey,
							kind: event.kind
						}
					)}&kind={event.kind}"
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
		font-size: 1.5em;
		margin-block-start: 0.3em;
		margin-block-end: 0.3em;
	}

	.content {
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
</style>
