<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';

	let q = '';
	let timeline: Event[] = [];
	let users: Map<string, User> = new Map();

	const searchRelay = 'wss://relay.nostr.band';

	afterNavigate(async () => {
		const query = $page.url.searchParams.get('q');
		if (query !== null) {
			console.log('[q]', query);
			q = query;
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

	interface Event {
		id: string;
		pubkey: string;
		created_at: number;
		kind: number;
		tags: string[][];
		content: string;
		sig: string;
	}

	interface User {
		name: string;
		display_name: string;
		picture: string;
	}
</script>

<main>
	<h1>Search</h1>
	<form action="/search">
		<input type="text" name="q" value={q} />
		<input type="submit" value="Search" />
	</form>

	<ul>
		{#each timeline as note}
			<li>
				<article>
					<div>
						<img class="picture" src={users.get(note.pubkey)?.picture} alt="" />
					</div>
					<div class="note">
						<div class="user">
							<span class="display_name">{users.get(note.pubkey)?.display_name}</span>
							<span class="name">@{users.get(note.pubkey)?.name}</span>
						</div>
						<div class="content">{note.content}</div>
						<div class="created_at">{new Date(note.created_at * 1000)}</div>
					</div>
				</article>
			</li>
		{/each}
	</ul>
</main>

<style>
	ul {
		list-style: none;
		padding: 0;
		border: 1px solid rgb(239, 243, 244);
		border-bottom-style: none;
	}

	li {
		border-bottom: 1px solid rgb(239, 243, 244);
	}

	article {
		padding: 12px 16px;
		display: flex;
		flex-direction: row;
	}

	.picture {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		margin-right: 12px;
	}

	.note {
		color: rgb(15, 20, 25);
		font-size: 15px;
		font-weight: 400;
	}

	.user {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		font-family: 'Segoe UI', Meiryo, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
	}

	.display_name {
		margin-right: 4px;
		font-weight: 700;
	}

	.name {
		color: rgb(83, 100, 113);
		font-size: 15px;
	}

	.content {
		line-height: 20px;
	}

	.created_at {
		color: gray;
		font-size: 0.5em;
	}
</style>
