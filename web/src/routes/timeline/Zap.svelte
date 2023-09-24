<script lang="ts">
	import { EventItem } from '$lib/Items';
	import IconBolt from '@tabler/icons-svelte/dist/svelte/icons/IconBolt.svelte';
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';
	import { pool } from '../../stores/Pool';
	import type { User } from '../types';
	import { readRelays } from '../../stores/Author';
	import { nip19, type Event } from 'nostr-tools';
	import CreatedAt from '../CreatedAt.svelte';
	import { onMount } from 'svelte';
	import { Api } from '$lib/Api';
	import NoteLink from './NoteLink.svelte';
	import EventComponent from './EventComponent.svelte';

	export let event: Event;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	let user: User | undefined;
	let originalEvent: EventItem | undefined;
	let jsonDisplay = false;

	const originalTag = event.tags.find(
		(tag) =>
			tag.at(0) === 'e' && (tag.at(3) === 'mention' || tag.at(3) === 'root' || tag.length < 4)
	);

	const descriptionTag = event.tags.find(([tagName]) => tagName === 'description')?.at(1);
	console.debug('[zap request]', event.id, descriptionTag);
	let zapRequestEvent: Event | undefined;
	try {
		zapRequestEvent = JSON.parse(descriptionTag ?? '{}') as Event;
	} catch (error) {
		console.error('[invalid description tag]', error, descriptionTag);
	}

	const api = new Api($pool, $readRelays);

	onMount(async () => {
		if (originalTag !== undefined) {
			const eventId = originalTag[1];
			const e = await api.fetchEventById(eventId);
			if (e !== undefined) {
				originalEvent = new EventItem(e);
			}
		} else {
			console.warn('[zapped event not found]', event);
		}

		api.fetchUserEvent(event.pubkey).then((userEvent) => {
			user = userEvent?.user;
		});
	});

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};
</script>

<article class="timeline-item">
	<div class="user">
		<div>
			<IconBolt size={18} color={'#f59f00'} />
		</div>
		<div>by</div>
		{#if zapRequestEvent === undefined}
			<div>Unknown</div>
		{:else}
			{#await api.fetchUserEvent(zapRequestEvent.pubkey)}
				<div>@...</div>
			{:then zapUserEvent}
				<div>
					<a href="/{nip19.npubEncode((zapUserEvent ?? event).pubkey)}">
						@{(zapUserEvent?.user ?? user)?.name ??
							nip19
								.npubEncode((zapUserEvent ?? event).pubkey)
								.substring(0, 'npub1'.length + 7)}
					</a>
				</div>
			{/await}
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
	{#if zapRequestEvent !== undefined && zapRequestEvent.content}
		<div class="content">{zapRequestEvent.content}</div>
	{/if}
</article>
{#if jsonDisplay}
	<div class="develop">
		<h5>Event ID</h5>
		<div>{nip19.noteEncode(event.id)}</div>
		<br />
		<div>{nip19.neventEncode({ id: event.id })}</div>
		<h5>Event JSON</h5>
		<pre><code class="json">{JSON.stringify(event, null, 2)}</code></pre>
		<h5>Zap Request Event JSON</h5>
		<pre><code class="json">{JSON.stringify(zapRequestEvent, null, 2)}</code></pre>
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

	.develop pre {
		background-color: #f6f8fa;
		padding: 0.5em;
		overflow: auto;
	}
	.develop .json {
		font-size: 0.8em;
	}
</style>
