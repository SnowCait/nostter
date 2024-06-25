<script lang="ts">
	import type { EventItem, Item } from '$lib/Items';
	import { eventItemStore, metadataStore } from '$lib/cache/Events';
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';
	import IconHeart from '@tabler/icons-svelte/dist/svelte/icons/IconHeart.svelte';
	import IconHeartBroken from '@tabler/icons-svelte/dist/svelte/icons/IconHeartBroken.svelte';
	import { nip19 } from 'nostr-tools';
	import CreatedAt from '$lib/components/CreatedAt.svelte';
	import NoteLink from './NoteLink.svelte';
	import EventComponent from './EventComponent.svelte';
	import Content from '$lib/components/Content.svelte';
	import OnelineProfile from '../profile/OnelineProfile.svelte';

	export let item: Item;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	const { event } = item;

	$: metadata = $metadataStore.get(event.pubkey);

	let originalEvent: EventItem | undefined;
	let jsonDisplay = false;

	const eTags = event.tags.filter(
		([tagName, tagContent]) => tagName === 'e' && tagContent !== undefined
	);
	const originalTag = eTags.at(eTags.length - 1);

	$: if (originalTag !== undefined) {
		originalEvent = $eventItemStore.get(originalTag[1]);
	}

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};
</script>

<article class="timeline-item">
	<div>
		{#if event.content === '+' || event.content === ''}
			<IconHeart size={18} color={'lightpink'} />
		{:else if event.content === '-'}
			<IconHeartBroken size={18} color={'lightpink'} />
		{:else}
			<Content content={event.content} tags={event.tags} />
		{/if}
	</div>
	<div>by</div>
	<div class="profile">
		<a href="/{nip19.npubEncode(event.pubkey)}">
			<OnelineProfile pubkey={event.pubkey} />
		</a>
	</div>
	<div class="json-button">
		<button class="clear" on:click={toggleJsonDisplay}>
			<IconCodeDots size={18} />
		</button>
	</div>
	<div class="created-at">
		<CreatedAt createdAt={event.created_at} format={createdAtFormat} />
	</div>
</article>
{#if jsonDisplay}
	<div class="develop">
		<h5>Event ID</h5>
		<div>{nip19.noteEncode(event.id)}</div>
		<br />
		<div>{nip19.neventEncode({ id: event.id })}</div>
		<h5>Event JSON</h5>
		<code>{JSON.stringify(event, null, 2)}</code>
		<h5>User ID</h5>
		<div>{nip19.npubEncode(event.pubkey)}</div>
		<h5>User JSON</h5>
		<code>{JSON.stringify(metadata?.content, null, 2)}</code>
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
	article {
		display: flex;
		flex-direction: row;
		gap: 0.2rem;
	}

	.json-button {
		margin-left: auto;
		margin-top: auto;
		margin-bottom: auto;
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
</style>
