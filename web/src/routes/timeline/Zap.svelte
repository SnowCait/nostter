<script lang="ts">
	import { IconBolt, IconCodeDots } from '@tabler/icons-svelte';
	import { pool } from '../../stores/Pool';
	import Note from './Note.svelte';
	import type { Event as NostrEvent } from '../types';
	import { relayUrls } from '../../stores/Author';
	import { nip19, type Event } from 'nostr-tools';
	import CreatedAt from '../CreatedAt.svelte';
	import { onMount } from 'svelte';
	import { Api } from '$lib/Api';

	export let event: NostrEvent;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	let originalEvent: NostrEvent | undefined;
	let jsonDisplay = false;

	const originalTag = event.tags.find(
		(tag) =>
			tag.at(0) === 'e' && (tag.at(3) === 'mention' || tag.at(3) === 'root' || tag.length < 4)
	);

	const descriptionTag = event.tags.find(([tagName]) => tagName === 'description')?.at(1);
	console.debug('[zap request]', event.id, descriptionTag);
	const zapRequestEvent = JSON.parse(descriptionTag ?? '{}') as Event;

	const api = new Api($pool, $relayUrls);

	onMount(async () => {
		if (originalTag !== undefined) {
			const eventId = originalTag[1];
			originalEvent = await api.fetchEventById(eventId);
		} else {
			console.warn('[zapped event not found]', event);
		}
	});

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};
</script>

<article>
	<div class="user">
		<div>
			<IconBolt size={18} color={'#f59f00'} />
		</div>
		<div>by</div>
		{#await api.fetchUserEvent(zapRequestEvent.pubkey)}
			<div>@...</div>
		{:then zapUserEvent}
			<div>
				<a href="/{nip19.npubEncode((zapUserEvent ?? event).pubkey)}">
					@{(zapUserEvent ?? event).user?.name ??
						(zapUserEvent ?? event).pubkey.substring('npub1'.length + 7)}
				</a>
			</div>
		{/await}
		<div class="json-button">
			<button on:click={toggleJsonDisplay}>
				<IconCodeDots size={15} />
			</button>
		</div>
		<div class="created-at">
			<CreatedAt createdAt={event.created_at} format={createdAtFormat} />
		</div>
	</div>
	{#if zapRequestEvent.content}
		<div class="content">{zapRequestEvent.content}</div>
	{/if}
</article>
{#if jsonDisplay}
	<div class="develop">
		<h5>Event JSON</h5>
		<pre><code class="json">{JSON.stringify(event, null, 2)}</code></pre>
		<h5>Zap Request Event JSON</h5>
		<pre><code class="json">{JSON.stringify(zapRequestEvent, null, 2)}</code></pre>
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
