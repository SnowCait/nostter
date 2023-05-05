<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { Api } from '$lib/Api';
	import { Kind } from 'nostr-tools';
	import { relayUrls } from '../../stores/Author';
	import { searchEvents } from '../../stores/Events';
	import { pool } from '../../stores/Pool';
	import { saveMetadataEvent } from '../../stores/UserEvents';
	import TimelineView from '../TimelineView.svelte';
	import type { Event } from '../types';
	import NoteIdsView from './NoteIdsView.svelte';

	let query = '';

	const searchRelay = 'wss://relay.nostr.band';

	afterNavigate(async () => {
		query = $page.url.searchParams.get('q') ?? '';
		$searchEvents = [];
		if (query !== '') {
			console.log('[q]', query);
			await search(searchRelay, query);
		}
	});

	async function search(relay: string, query: string) {
		const ws = new WebSocket(relay);
		ws.onerror = (event) => {
			console.error(event);
		};
		ws.onopen = () => {
			console.log('Opened');
			ws.send(
				JSON.stringify([
					'REQ',
					Math.floor(Math.random() * 99999).toString(),
					{
						search: query,
						limit: 1000
					}
				])
			);
		};
		ws.onclose = () => {
			console.log('Closed');
		};
		ws.onmessage = async (event) => {
			console.log('Message');
			const data = JSON.parse(event.data);
			console.log(data);
			switch (data[0]) {
				case 'EOSE': {
					console.log('[result]', $searchEvents);

					const api = new Api($pool, $relayUrls);
					for (const event of $searchEvents) {
						const userEvent = await api.fetchUserEvent(event.pubkey);
						if (userEvent !== undefined) {
							event.user = userEvent.user;
						}
					}

					$searchEvents = $searchEvents;
					break;
				}
				case 'EVENT': {
					const e = data[2] as Event;
					switch (e.kind) {
						case Kind.Metadata: {
							await saveMetadataEvent(e);
							break;
						}
						case Kind.Text: {
							$searchEvents.push(e);
							break;
						}
					}
					break;
				}
			}
		};
	}
</script>

<svelte:head>
	<title>nostter - {query ? `Search: ${query}` : 'Search'}</title>
</svelte:head>

<h1><a href="/search">Search</a></h1>

<form action="/search">
	<input type="text" name="q" value={query} on:keyup|stopPropagation={() => console.debug()} />
	<input type="submit" value="Search" />
</form>

<NoteIdsView />

<TimelineView events={$searchEvents} load={async () => console.debug()} showLoading={false} />

<style>
	h1 a {
		color: inherit;
		text-decoration: none;
	}

	@media screen and (max-width: 600px) {
		h1,
		form {
			margin: 0.67em;
		}
	}
</style>
