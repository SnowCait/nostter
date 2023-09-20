<script lang="ts">
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';
	import IconRepeat from '@tabler/icons-svelte/dist/svelte/icons/IconRepeat.svelte';
	import { pool } from '../../stores/Pool';
	import type { Event as NostrEvent, User } from '../types';
	import { readRelays } from '../../stores/Author';
	import { nip19 } from 'nostr-tools';
	import CreatedAt from '../CreatedAt.svelte';
	import { onMount } from 'svelte';
	import { Api } from '$lib/Api';
	import NoteLink from './NoteLink.svelte';
	import EventComponent from './EventComponent.svelte';

	export let event: NostrEvent;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	let user: User | undefined;
	let originalEvent: NostrEvent | undefined;
	let jsonDisplay = false;

	let originalTag = event.tags.find(
		([tagName, , , marker]) => tagName === 'e' && (marker === 'mention' || marker === undefined)
	);

	// Workaround for some incorrect clients
	if (originalTag === undefined) {
		originalTag = event.tags.findLast(([t]) => t === 'e');
	}

	onMount(async () => {
		const api = new Api($pool, $readRelays);
		api.fetchUserEvent(event.pubkey).then((userEvent) => {
			user = userEvent?.user;
		});

		if (originalTag === undefined) {
			console.warn('[repost not found]', event);
			return;
		}

		const eventId = originalTag[1];
		originalEvent = await api.fetchEventById(eventId);
	});

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
		<a href="/{nip19.npubEncode(event.pubkey)}">
			@{user?.name ?? nip19.npubEncode(event.pubkey).substring('npub1'.length + 7)}
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
		<pre><code class="json">{JSON.stringify(event.user, null, 2)}</code></pre>
	</div>
{/if}
{#if originalEvent !== undefined}
	<EventComponent event={originalEvent} {readonly} {createdAtFormat} />
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
