<script lang="ts">
	import type { EventItem, Item } from '$lib/Items';
	import { eventItemStore, metadataStore } from '$lib/cache/Events';
	import IconCodeDots from '@tabler/icons-svelte/icons/code-dots';
	import IconRepeat from '@tabler/icons-svelte/icons/repeat';
	import { nip19 } from 'nostr-tools';
	import { deletedEventIdsByPubkey } from '$lib/author/Delete';
	import { isMuteEvent } from '$lib/stores/Author';
	import { developerMode } from '$lib/stores/Preference';
	import CreatedAt from '$lib/components/CreatedAt.svelte';
	import NoteLink from './NoteLink.svelte';
	import EventComponent from './EventComponent.svelte';
	import DeletedContent from './DeletedContent.svelte';
	import MutedContent from './MutedContent.svelte';
	import OnelineProfile from '../profile/OnelineProfile.svelte';
	import SeenOnRelays from '../SeenOnRelays.svelte';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';

	export let item: Item;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	const { event } = item;

	$: metadata = $metadataStore.get(event.pubkey);
	$: nevent = nip19.neventEncode({
		id: event.id,
		relays: getSeenOnRelays(event.id),
		author: event.pubkey,
		kind: event.kind
	});

	let originalEvent: EventItem | undefined;
	let jsonDisplay = false;

	let originalTag = event.tags.find(
		([tagName, eventId, , marker]) =>
			tagName === 'e' &&
			eventId !== undefined &&
			(marker === 'mention' || marker === undefined)
	);

	// Workaround for some incorrect clients
	if (originalTag === undefined) {
		originalTag = event.tags.findLast(
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
	<div class="profile">
		<a href="/{nip19.npubEncode(event.pubkey)}">
			<OnelineProfile pubkey={event.pubkey} />
		</a>
	</div>
	{#if $developerMode}
		<div class="json-button right">
			<button class="clear" on:click={toggleJsonDisplay}>
				<IconCodeDots size={18} />
			</button>
		</div>
	{/if}
	<div class="created-at" class:right={!$developerMode}>
		<CreatedAt createdAt={event.created_at} format={createdAtFormat} />
	</div>
</article>
{#if jsonDisplay}
	<div class="develop">
		<h5>Event ID</h5>
		<div>{nip19.noteEncode(event.id)}</div>
		<br />
		<div>{nevent}</div>
		<h5>Event JSON</h5>
		<code>{JSON.stringify(event, null, 2)}</code>
		<h5>User ID</h5>
		<div>{nip19.npubEncode(event.pubkey)}</div>
		<h5>User JSON</h5>
		<code>{JSON.stringify(metadata?.content, null, 2)}</code>
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
	article {
		display: flex;
		flex-direction: row;
		gap: 0.2rem;
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
