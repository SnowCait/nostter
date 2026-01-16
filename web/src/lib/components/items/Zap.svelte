<script lang="ts">
	import { onMount } from 'svelte';
	import { nip19 } from 'nostr-tools';
	import { deletedEventIdsByPubkey } from '$lib/author/Delete';
	import { getSeenOnRelays, metadataReqEmit } from '$lib/timelines/MainTimeline';
	import { ZapEventItem, type EventItem, type Item, type Metadata } from '$lib/Items';
	import { eventItemStore, metadataStore } from '$lib/cache/Events';
	import { isMuteEvent } from '$lib/stores/Author';
	import { developerMode } from '$lib/stores/Preference';
	import IconBolt from '@tabler/icons-svelte/icons/bolt';
	import IconCodeDots from '@tabler/icons-svelte/icons/code-dots';
	import CreatedAt from '../CreatedAt.svelte';
	import NoteLink from './NoteLink.svelte';
	import EventComponent from './EventComponent.svelte';
	import OnelineProfile from '../profile/OnelineProfile.svelte';
	import DeletedContent from './DeletedContent.svelte';
	import MutedContent from './MutedContent.svelte';
	import SeenOnRelays from '../SeenOnRelays.svelte';

	interface Props {
		item: Item;
		readonly: boolean;
		createdAtFormat?: 'auto' | 'time';
	}

	let { item, readonly, createdAtFormat = 'auto' }: Props = $props();

	let event = $derived(item.event);
	let zap = $derived(new ZapEventItem(event));

	let metadata = $derived($metadataStore.get(event.pubkey));
	let nevent = $derived(
		nip19.neventEncode({
			id: event.id,
			relays: getSeenOnRelays(event.id),
			author: event.pubkey,
			kind: event.kind
		})
	);

	let zapperMetadata: Metadata | undefined = $state();

	$effect(() => {
		if (zap.requestEvent !== undefined) {
			zapperMetadata = $metadataStore.get(zap.requestEvent.pubkey);
		}
	});

	let originalEvent: EventItem | undefined = $state();
	let jsonDisplay = $state(false);

	let originalTag = $derived(
		event.tags.find(
			(tag) =>
				tag.at(0) === 'e' &&
				(tag.at(3) === 'mention' || tag.at(3) === 'root' || tag.length < 4)
		)
	);

	$effect(() => {
		if (originalTag !== undefined) {
			originalEvent = $eventItemStore.get(originalTag[1]);
		}
	});

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
			<div class="profile">
				{#if zapperMetadata !== undefined}
					<a href="/{nip19.npubEncode(zapperMetadata.event.pubkey)}">
						<OnelineProfile pubkey={zapperMetadata.event.pubkey} />
					</a>
				{:else}
					<span>-</span>
				{/if}
			</div>
		{/if}
		{#if $developerMode}
			<div class="json-button right">
				<button class="clear" onclick={toggleJsonDisplay}>
					<IconCodeDots size={15} />
				</button>
			</div>
		{/if}
		<div class="created-at" class:right={!$developerMode}>
			<CreatedAt createdAt={event.created_at} format={createdAtFormat} />
		</div>
	</div>
	{#if zap.comment}
		<div class="content">{zap.comment}</div>
	{/if}
</article>
{#if jsonDisplay}
	<div class="develop">
		<div>
			<span>via</span>
			<a href="/{nip19.npubEncode(event.pubkey)}">
				<OnelineProfile pubkey={event.pubkey} />
			</a>
		</div>
		<h5>Event ID</h5>
		<div>{nip19.noteEncode(event.id)}</div>
		<br />
		<div>{nevent}</div>
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
{#if originalEvent !== undefined}
	{#if $deletedEventIdsByPubkey.get(item.event.pubkey)?.has(originalEvent.id)}
		<DeletedContent />
	{:else if isMuteEvent(originalEvent.event)}
		<MutedContent />
	{:else}
		<EventComponent item={originalEvent} {readonly} {createdAtFormat} />
	{/if}
{:else if originalTag !== undefined}
	<NoteLink eventId={originalTag[1]} />
{/if}

<style>
	.user {
		display: flex;
		flex-direction: row;
		gap: 0.2rem;
	}

	.content {
		margin: 0.5em;
	}

	.json-button {
		margin: auto 0;
	}

	button {
		color: var(--accent-gray);
		display: flex;
	}

	.profile {
		overflow: hidden;
		text-overflow: ellipsis;
		text-wrap: nowrap;
	}

	.profile a {
		text-decoration: none;
	}

	.right {
		margin-left: auto;
	}
</style>
