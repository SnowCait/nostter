<script lang="ts">
	import { IconCodeDots, IconHeart, IconHeartBroken } from '@tabler/icons-svelte';
	import { pool } from '../../stores/Pool';
	import NoteView from '../NoteView.svelte';
	import type { Event as NostrEvent, User } from '../types';
	import { relayUrls } from '../../stores/Author';
	import { nip19 } from 'nostr-tools';
	import CreatedAt from '../CreatedAt.svelte';
	import { onMount } from 'svelte';
	import { Api } from '$lib/Api';

	export let event: NostrEvent;
	export let readonly: boolean;

	let user: User | undefined;
	let originalEvent: NostrEvent | undefined;
	let jsonDisplay = false;

	const eTags = event.tags.filter(
		([tagName, tagContent]) => tagName === 'e' && tagContent !== undefined
	);
	const originalTag = eTags.at(eTags.length - 1);

	onMount(async () => {
		const api = new Api($pool, $relayUrls);
		api.fetchUserEvent(event.pubkey).then((userEvent) => {
			user = userEvent?.user;
		});

		if (originalTag === undefined) {
			console.warn('[reacted event not found]', event);
			return;
		}

		const [, eventId] = originalTag;
		originalEvent = await api.fetchEvent(eventId);
	});

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};
</script>

<article>
	<div>
		{#if event.content === '+'}
			<IconHeart size={18} color={'lightpink'} />
		{:else if event.content === '-'}
			<IconHeartBroken size={18} color={'lightpink'} />
		{:else}
			<span>{event.content}</span>
		{/if}
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
		<CreatedAt createdAt={event.created_at} />
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
	<NoteView event={originalEvent} {readonly} />
{:else if originalTag !== undefined}
	<article>
		<a href="/{nip19.noteEncode(originalTag[1])}">
			{nip19.noteEncode(originalTag[1]).substring(0, 'note1'.length + 7)}
		</a>
	</article>
{/if}

<style>
	article {
		margin: 12px 16px;
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
