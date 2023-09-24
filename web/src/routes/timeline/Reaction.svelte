<script lang="ts">
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';
	import IconHeart from '@tabler/icons-svelte/dist/svelte/icons/IconHeart.svelte';
	import IconHeartBroken from '@tabler/icons-svelte/dist/svelte/icons/IconHeartBroken.svelte';
	import { pool } from '../../stores/Pool';
	import type { Event as NostrEvent, User } from '../types';
	import { readRelays } from '../../stores/Author';
	import { nip19, type Event } from 'nostr-tools';
	import CreatedAt from '../CreatedAt.svelte';
	import { onMount } from 'svelte';
	import { Api } from '$lib/Api';
	import NoteLink from './NoteLink.svelte';
	import EventComponent from './EventComponent.svelte';
	import Content from '../content/Content.svelte';

	export let event: Event;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	let user: User | undefined;
	let originalEvent: NostrEvent | undefined;
	let jsonDisplay = false;

	const eTags = event.tags.filter(
		([tagName, tagContent]) => tagName === 'e' && tagContent !== undefined
	);
	const originalTag = eTags.at(eTags.length - 1);

	onMount(async () => {
		const api = new Api($pool, $readRelays);
		api.fetchUserEvent(event.pubkey).then((userEvent) => {
			user = userEvent?.user;
		});

		if (originalTag === undefined) {
			console.warn('[reacted event not found]', event);
			return;
		}

		const [, eventId] = originalTag;
		originalEvent = await api.fetchEventById(eventId);
	});

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};
</script>

<article class="timeline-item">
	<div>
		{#if event.content === '+'}
			<IconHeart size={18} color={'lightpink'} />
		{:else if event.content === '-'}
			<IconHeartBroken size={18} color={'lightpink'} />
		{:else}
			<Content content={event.content} tags={event.tags} />
		{/if}
	</div>
	<div>by</div>
	<div>
		<a href="/{nip19.npubEncode(event.pubkey)}">
			@{user?.name ?? nip19.npubEncode(event.pubkey).substring(0, 'npub1'.length + 7)}
		</a>
	</div>
	<div class="json-button">
		<button on:click={toggleJsonDisplay}>
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
		<pre><code class="json">{JSON.stringify(event, null, 2)}</code></pre>
		<h5>User ID</h5>
		<div>{nip19.npubEncode(event.pubkey)}</div>
		<h5>User JSON</h5>
		<pre><code class="json">{JSON.stringify(user, null, 2)}</code></pre>
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
{#if originalEvent !== undefined}
	<EventComponent eventItem={originalEvent} {readonly} {createdAtFormat} />
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
