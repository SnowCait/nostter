<script lang="ts">
	import { onMount } from 'svelte';
	import { nip19 } from 'nostr-tools';
	import { metadataReqEmit } from '$lib/timelines/MainTimeline';
	import { ZapEventItem, type EventItem, type Item, type Metadata } from '$lib/Items';
	import { eventItemStore, metadataStore } from '$lib/cache/Events';
	import IconBolt from '@tabler/icons-svelte/dist/svelte/icons/IconBolt.svelte';
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';
	import CreatedAt from '../CreatedAt.svelte';
	import NoteLink from './NoteLink.svelte';
	import EventComponent from './EventComponent.svelte';

	export let item: Item;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	const event = item.event;

	$: zap = new ZapEventItem(item.event);
	$: metadata = $metadataStore.get(item.event.pubkey);

	let zapperMetadata: Metadata | undefined;

	$: if (zap.requestEvent !== undefined) {
		zapperMetadata = $metadataStore.get(zap.requestEvent.pubkey);
	}

	let originalEvent: EventItem | undefined;
	let jsonDisplay = false;

	const originalTag = event.tags.find(
		(tag) =>
			tag.at(0) === 'e' && (tag.at(3) === 'mention' || tag.at(3) === 'root' || tag.length < 4)
	);

	$: if (originalTag !== undefined) {
		originalEvent = $eventItemStore.get(originalTag[1]);
	}

	onMount(() => {
		if (zap.requestEvent !== undefined) {
			metadataReqEmit([zap.requestEvent.pubkey]);
		}
	});

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};
</script>

<article class="timeline-item">
	<div class="user">
		<div style="display: flex;">
			<IconBolt size={18} color={'#f59f00'} />
			{#if zap?.amount !== undefined}
				<span>{zap.amount.toLocaleString()}</span>
			{/if}
		</div>
		<div>by</div>
		{#if zap === undefined}
			<div>Unknown</div>
		{:else}
			<div>
				{#if zapperMetadata !== undefined}
					<a href="/{nip19.npubEncode(zapperMetadata.event.pubkey)}">
						@{zapperMetadata.name}
					</a>
				{:else}
					<span>-</span>
				{/if}
			</div>
		{/if}
		<div class="json-button">
			<button on:click={toggleJsonDisplay}>
				<IconCodeDots size={15} />
			</button>
		</div>
		<div class="created-at">
			<CreatedAt createdAt={event.created_at} format={createdAtFormat} />
		</div>
	</div>
	{#if zap.comment}
		<div class="content">{zap.comment}</div>
	{/if}
</article>
{#if jsonDisplay}
	<div class="develop">
		<h5>Event ID</h5>
		<div>{nip19.noteEncode(event.id)}</div>
		<br />
		<div>{nip19.neventEncode({ id: event.id })}</div>
		<h5>Event JSON</h5>
		<code>{JSON.stringify(event, null, 2)}</code>
		<h5>Zap Request Event JSON</h5>
		<code>{JSON.stringify(zap.requestEvent, null, 2)}</code>
		<h5>User ID</h5>
		<div>{nip19.npubEncode(event.pubkey)}</div>
		<h5>User JSON</h5>
		<code>{JSON.stringify(metadata?.content, null, 2)}</code>
		<h5>Invoice</h5>
		<code>{JSON.stringify(zap.invoice, null, 2)}</code>
		<div>
			Open in <a
				href="https://koteitan.github.io/nostr-post-checker/?hideform&eid={nip19.neventEncode(
					{
						id: event.id
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
{#if originalEvent !== undefined}
	<EventComponent item={originalEvent} {readonly} {createdAtFormat} />
{:else if originalTag !== undefined}
	<NoteLink eventId={originalTag[1]} />
{/if}

<style>
	.user {
		display: flex;
		flex-direction: row;
	}

	.user div {
		margin-right: 0.2em;
	}

	.content {
		margin: 0.5em;
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
</style>
