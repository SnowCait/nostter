<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';

	let timeline: Event[] = [];

	const searchRelay = 'wss://relay.nostr.band';

	afterNavigate(async () => {
		const query = $page.url.searchParams.get('q');
		if (query !== null) {
			console.log('[q]', query);
			timeline = [];
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
						limit: 500,
					},
				])
			);
		};
		ws.onclose = () => {
			console.log('Closed');
		};
		ws.onmessage = event => {
			console.log('Message');
			const data = JSON.parse(event.data);
			console.log(data);
			switch (data[0]) {
				case 'EOSE':
					eose = true;
					break;
				case 'EVENT':
					const e: Event = data[2];
					if (eose) {
						timeline.unshift(e);
					} else {
						timeline.push(e);
					}
					timeline = timeline;
					break;
			}
		};
	}

	interface Event {
		id: string;
		pubkey: string;
		created_at: number;
		kind: number;
		tags: string[][];
		content: string;
		sig: string;
	}
</script>

<main>
	<h1>Search</h1>
	<form action="/search">
		<input type="text" name="q" />
		<input type="submit" value="Search" />
	</form>

	<ul>
		{#each timeline as note}
			<li>{note.content} <span style="color: lightgra; font-size: 0.5em;">at {new Date(note.created_at * 1000)}</span></li>
		{/each}
	</ul>
</main>
