<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import Note from '../Note.svelte';
	import type { Event, User } from '../types';

	let query = '';
	let timeline: Event[] = [];
	let users: Map<string, User> = new Map();

	const searchRelay = 'wss://relay.nostr.band';

	afterNavigate(async () => {
		query = $page.url.searchParams.get('q') ?? '';
		timeline = [];
		if (query !== '') {
			console.log('[q]', query);
			await search(searchRelay, query);
		}
	});

	async function search(relay: string, query: string) {
		let eose = false;

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
					eose = true;
					console.log('[result]', timeline, users);

					if (timeline.length > 0 && users.size === 0) {
						const pubkeys = new Set(timeline.map((x) => x.pubkey));
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
					const e: Event = data[2];
					switch (e.kind) {
						case 0:
							const user = JSON.parse(e.content);
							console.log(user);
							users.set(e.pubkey, user);
							break;
						case 1:
							timeline.push(e);
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

	<ul>
		{#each timeline as note}
			<li>
				<Note {note} user={users.get(note.pubkey)} />
			</li>
		{/each}
	</ul>
</main>

<style>
	h1 a {
		color: inherit;
		text-decoration: none;
	}

	ul {
		list-style: none;
		padding: 0;
		border: 1px solid rgb(239, 243, 244);
		border-bottom-style: none;
	}

	li {
		border-bottom: 1px solid rgb(239, 243, 244);
	}
</style>
