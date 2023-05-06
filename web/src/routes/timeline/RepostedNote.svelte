<script lang="ts">
	import { IconCodeDots, IconRepeat } from '@tabler/icons-svelte';
	import { pool } from '../../stores/Pool';
	import Note from './Note.svelte';
	import type { Event as NostrEvent, User } from '../types';
	import { relayUrls } from '../../stores/Author';
	import { nip19 } from 'nostr-tools';
	import CreatedAt from '../CreatedAt.svelte';
	import { onMount } from 'svelte';
	import { Api } from '$lib/Api';

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
		const api = new Api($pool, $relayUrls);
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

<article>
	<div>
		<IconRepeat size={18} color={'lightgreen'} />
	</div>
	<div>by</div>
	<div>
		<a href="/{nip19.npubEncode(event.pubkey)}">
			@{user?.name ?? event.pubkey.substring('npub1'.length + 7)}
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
		<h5>Event JSON</h5>
		<pre><code class="json">{JSON.stringify(event, null, 2)}</code></pre>
		<h5>User JSON</h5>
		<pre><code class="json">{JSON.stringify(event.user, null, 2)}</code></pre>
	</div>
{/if}
{#if originalEvent !== undefined}
	<Note event={originalEvent} {readonly} {createdAtFormat} />
{:else if originalTag !== undefined}
	<article>
		<a href="/{nip19.noteEncode(originalTag[1])}">
			{nip19.noteEncode(originalTag[1]).substring(0, 'note1'.length + 7)}
		</a>
	</article>
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
