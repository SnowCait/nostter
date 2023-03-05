<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { events } from '../../stores/Events';
	import { userEvents, saveUserEvent } from '../../stores/UserEvents';
	import TimelineView from '../TimelineView.svelte';
	import type { Event, UserEvent, User } from '../types';

	let query = '';

	const searchRelay = 'wss://relay.nostr.band';

	afterNavigate(async () => {
		query = $page.url.searchParams.get('q') ?? '';
		$events = [];
		$userEvents.clear();
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
					console.log('[result]', $events);

					if ($events.length > 0 && $userEvents.size === 0) {
						const pubkeys = new Set($events.map((x) => x.pubkey));
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
						for (const event of $events) {
							const userEvent = $userEvents.get(event.pubkey);
							if (userEvent === undefined) {
								console.error(`${event.pubkey} is not found in $userEvents`);
								continue;
							}
							event.user = userEvent.user;
						}

						$events = $events;

						ws.close();
					}
					break;
				case 'EVENT':
					const e = data[2] as Event;
					switch (e.kind) {
						case 0:
							const user = JSON.parse(e.content) as User;
							console.log(user);
							const userEvent: UserEvent = {
								...e,
								user
							};
							saveUserEvent(userEvent);
							break;
						case 1:
							$events.push(e);
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

	<TimelineView />
</main>

<style>
	h1 a {
		color: inherit;
		text-decoration: none;
	}
</style>
