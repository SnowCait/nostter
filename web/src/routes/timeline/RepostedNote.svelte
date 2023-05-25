<script lang="ts">
	import { IconCodeDots, IconRepeat } from '@tabler/icons-svelte';
	import { pool } from '../../stores/Pool';
	import type { Event as NostrEvent, User } from '../types';
	import { readRelays } from '../../stores/Author';
	import { Kind, nip19 } from 'nostr-tools';
	import CreatedAt from '../CreatedAt.svelte';
	import { onMount } from 'svelte';
	import { Api } from '$lib/Api';
	import NoteLink from './NoteLink.svelte';
	import EventComponent from './EventComponent.svelte';
	import NaddrLink from './NaddrLink.svelte';

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

	let originalAddressTag: string[] | undefined;
	let kindString: string | undefined;
	let pubkey: string | undefined;
	let identifier: string | undefined;

	if (originalTag === undefined) {
		originalAddressTag = event.tags.find(
			([tagName, tagContent, , marker]) =>
				tagName === 'a' &&
				tagContent !== undefined &&
				(marker === 'mention' || marker === undefined)
		);
	}

	onMount(async () => {
		const api = new Api($pool, $readRelays);
		api.fetchUserEvent(event.pubkey).then((userEvent) => {
			user = userEvent?.user;
		});

		if (originalTag !== undefined) {
			const eventId = originalTag[1];
			originalEvent = await api.fetchEventById(eventId);
		} else if (originalAddressTag !== undefined) {
			const relay = originalAddressTag.at(2);
			const addressApi = new Api(
				$pool,
				relay === undefined ? $readRelays : [...$readRelays, relay]
			);
			[kindString, pubkey, identifier] = originalAddressTag[1].split(':');
			const original = await addressApi.fetchEventByAddress(
				Number(kindString),
				pubkey,
				identifier
			);
			if (original !== undefined) {
				const userEvent = await api.fetchUserEvent(original.pubkey);
				if (userEvent === undefined) {
					originalEvent = original as NostrEvent;
				} else {
					let u: User;
					try {
						u = JSON.parse(userEvent.content);
						originalEvent = {
							...original,
							user: u
						};
					} catch (error) {
						console.warn('[invalid metadata]', error, userEvent.content);
						originalEvent = original as NostrEvent;
					}
				}
			}
		} else {
			console.warn('[original tag not found]', event);
		}

		if (originalEvent === undefined) {
			console.warn('[original event not found]', event);
		}
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
	<EventComponent event={originalEvent} {readonly} {createdAtFormat} />
{:else if originalTag !== undefined}
	<NoteLink eventId={originalTag[1]} />
{:else if originalAddressTag !== undefined && kindString !== undefined && pubkey !== undefined && identifier !== undefined}
	<NaddrLink kind={Number(kindString)} {pubkey} {identifier} />
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
