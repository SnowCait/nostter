<script lang="ts">
	import type { EventItem, Item } from '$lib/Items';
	import { eventItemStore, metadataStore } from '$lib/cache/Events';
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';
	import IconRepeat from '@tabler/icons-svelte/dist/svelte/icons/IconRepeat.svelte';
	import { nip19 } from 'nostr-tools';
	import CreatedAt from '../CreatedAt.svelte';
	import NoteLink from './NoteLink.svelte';
	import EventComponent from './EventComponent.svelte';

	export let item: Item;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	$: metadata = $metadataStore.get(item.event.pubkey);

	let originalEvent: EventItem | undefined;
	let jsonDisplay = false;

	let originalTag = item.event.tags.find(
		([tagName, eventId, , marker]) =>
			tagName === 'e' &&
			eventId !== undefined &&
			(marker === 'mention' || marker === undefined)
	);

	// Workaround for some incorrect clients
	if (originalTag === undefined) {
		originalTag = item.event.tags.findLast(
			([tagName, eventId]) => tagName === 'e' && eventId !== undefined
		);
	}

	$: if (originalTag !== undefined) {
		originalEvent = $eventItemStore.get(originalTag[1]);
	}

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};
</script>

<article class="timeline-item">
	<div>
		<IconRepeat size={18} color={'lightgreen'} />
	</div>
	<div>by</div>
	<div>
		<a href="/{nip19.npubEncode(item.event.pubkey)}">
			@{metadata?.content?.name ??
				nip19.npubEncode(item.event.pubkey).substring(0, 'npub1'.length + 7)}
		</a>
	</div>
	<div class="json-button">
		<button on:click={toggleJsonDisplay}>
			<IconCodeDots size={18} />
		</button>
	</div>
	<div class="created-at">
		<CreatedAt createdAt={item.event.created_at} format={createdAtFormat} />
	</div>
</article>
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
		<pre><code class="json">{JSON.stringify(metadata?.content, null, 2)}</code></pre>
		<div>
			Open in <a
				href="https://koteitan.github.io/nostr-post-checker/?eid={nip19.neventEncode({
					id: item.event.id
				})}&kind={item.event.kind}"
				target="_blank"
				rel="noopener noreferrer"
			>
				nostr-post-checker
			</a>
		</div>
	</div>
{/if}
{#if originalEvent !== undefined}
	<EventComponent item={originalEvent} {readonly} {createdAtFormat} />
{:else if originalTag !== undefined}
	<NoteLink eventId={originalTag[1]} />
{/if}

<style>
	article {
		display: flex;
		flex-direction: row;
	}

	article div {
		margin-right: 0.2em;
	}

	.json-button {
		margin-left: auto;
	}

	button {
		border: none;
		background-color: inherit;
		cursor: pointer;
		outline: none;
		padding: 0;
		color: var(--accent-gray);
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
