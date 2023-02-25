<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import TimelineView from '../TimelineView.svelte';
	import type { Timeline, Event } from '../types';

	let query = '';
	let timeline: Timeline = {
		events: [],
		users: new Map(),
	};

	const searchRelay = 'wss://relay.nostr.band';

	afterNavigate(async () => {
		query = $page.url.searchParams.get('q') ?? '';
		timeline.events = [];
		timeline.users = new Map();
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
		ws.onmessage = (event) => {
			console.log('Message');
			const data = JSON.parse(event.data);
			console.log(data);
			switch (data[0]) {
				case 'EOSE':
					console.log('[result]', timeline);

					if (timeline.events.length > 0 && timeline.users.size === 0) {
						const pubkeys = new Set(timeline.events.map((x) => x.pubkey));
						console.log(Array.from(pubkeys));
						ws.send(
							JSON.stringify([
								'REQ',
								Math.floor(Math.random() * 99999).toString(),
								{
									kinds: [0],
									authors: Array.from(pubkeys)
								}
							])
						);
					} else {
						// for reactivity https://svelte.dev/docs#component-format-script-2-assignments-are-reactive
						timeline = timeline;

						ws.close();
					}
					break;
				case 'EVENT':
					const e = data[2] as Event;
					switch (e.kind) {
						case 0:
							const user = JSON.parse(e.content);
							console.log(user);
							timeline.users.set(e.pubkey, user);
							break;
						case 1:
							timeline.events.push(e);
							break;
					}
					break;
			}
		};
	}
</script>

<svelte:head>
	<title>nostter - {query ? `Search: ${query}` : 'Search'}</title>
</svelte:head>

<main>
	<h1><a href="/search">Search</a></h1>
	<form action="/search">
		<input type="text" name="q" value={query} />
		<input type="submit" value="Search" />
	</form>

	<TimelineView timeline={timeline} />
</main>

<style>
	h1 a {
		color: inherit;
		text-decoration: none;
	}
</style>
