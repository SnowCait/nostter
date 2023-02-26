<script lang="ts" context="module">
	interface Window {
		// NIP-07
		nostr: any;
	}
	declare var window: Window;
</script>

<script lang="ts">
	import { SimplePool } from 'nostr-tools';
	import type { Timeline, Event, UserEvent, User, RelayPermission } from '../types';
	import TimelineView from '../TimelineView.svelte';

	let content = '';
	let timeline: Timeline = {
		events: [],
		userEvents: new Map()
	};
	let followee: Set<string> = new Set();
	let relays: Set<URL> = new Set();
	let loggedIn = false;
	let pawPad = false;

	const defaultRelays = [
		'wss://relay.damus.io',
		'wss://relay-jp.nostr.wirednet.jp',
		'wss://nostr-relay.nokotaro.com',
		'wss://nostr.h3z.jp',
		'wss://nostr.holybea.com',
		'wss://relay.nostr.or.jp'
	];

	const pool = new SimplePool();

	async function login() {
		if (window.nostr === undefined) {
			console.error('Please setup NIP-07');
			return;
		}

		loggedIn = true;

		const nip07Relays = (await window.nostr.getRelays()) as Map<string, RelayPermission>;
		console.log(nip07Relays);
		if (nip07Relays.size === 0) {
			console.warn('Please register relays on NIP-07');
		}

		const profileRelays = new Set([...Object.keys(nip07Relays), ...defaultRelays]);
		console.log(profileRelays);

		const pubkey: string = await window.nostr.getPublicKey();
		console.log(pubkey);
		const subscribeProfile = pool.sub(Array.from(profileRelays), [
			{
				kinds: [0, 2, 3, 10002],
				authors: [pubkey]
			}
		]);
		subscribeProfile.on('event', (event: Event) => {
			console.log(event);

			if (event.kind === 0) {
				const user = JSON.parse(event.content) as User;
				console.log(user);
			}

			if (event.kind === 2) {
				const recommendedRelay = JSON.parse(event.content);
				console.log(recommendedRelay);
			}

			if (event.kind === 3) {
				const relays = JSON.parse(event.content);
				followee = new Set(event.tags.map((x) => x[1]));
				console.log(relays, followee);
			}

			if (event.kind === 10002) {
				relays = new Set(event.tags.map((x) => new URL(x[1])));
				console.log(profileRelays);
			}
		});
		subscribeProfile.on('eose', () => {
			subscribeProfile.unsub();

			let initialized = false;
			const limit = 500;
			const since = Math.floor(Date.now() / 1000 - 24 * 60 * 60);
			const subscribeNotes = pool.sub(
				Array.from(relays).map((x) => x.href),
				[
					{
						kinds: [1],
						authors: Array.from(followee),
						limit,
						since
					}
				]
			);
			subscribeNotes.on('event', (event: Event) => {
				console.log(event);
				if (initialized) {
					timeline.events.unshift(event);
					timeline = timeline;
				} else {
					timeline.events.push(event);
				}
			});
			subscribeNotes.on('eose', () => {
				subscribeNotes.unsub();

				const pubkeys = new Set(timeline.events.map((x) => x.pubkey));

				const subscribeUsers = pool.sub(
					Array.from(relays).map((x) => x.href),
					[
						{
							kinds: [0],
							authors: Array.from(pubkeys)
						}
					]
				);
				subscribeUsers.on('event', (event: Event) => {
					const user = JSON.parse(event.content) as User;
					const userEvent: UserEvent = {
						...event,
						user
					};
					if (timeline.userEvents.has(event.pubkey)) {
						const e = timeline.userEvents.get(event.pubkey);
						if (e === undefined) {
							throw new Error('Logic error');
						}

						// Update if outdated
						if (e.created_at < userEvent.created_at) {
							timeline.userEvents.set(event.pubkey, userEvent);
						}
					} else {
						// New
						timeline.userEvents.set(event.pubkey, userEvent);
					}
				});
				subscribeUsers.on('eose', () => {
					subscribeUsers.unsub();

					timeline.events.sort((x, y) => y.created_at - x.created_at);
					timeline.events = timeline.events.slice(0, limit / 2);
					initialized = true;

					let upToDate = false;
					let newEvents: Event[] = [];
					const subscribe = pool.sub(
						Array.from(relays).map((x) => x.href),
						[
							{
								kinds: [1],
								authors: Array.from(followee),
								limit,
								since: timeline.events[0].created_at + 1
							}
						]
					);
					subscribe.on('event', (event: Event) => {
						console.log(event);
						if (upToDate) {
							if (timeline.userEvents.has(event.pubkey)) {
								timeline.events.unshift(event);
								timeline = timeline;
							} else {
								const subscribeUser = pool.sub(
									Array.from(relays).map((x) => x.href),
									[
										{
											kinds: [0],
											authors: [event.pubkey]
										}
									]
								);
								subscribeUser.on('event', (event: Event) => {
									const user = JSON.parse(event.content) as User;
									const userEvent: UserEvent = {
										...event,
										user
									};
									timeline.userEvents.set(event.pubkey, userEvent);
									timeline.userEvents = timeline.userEvents;
								});
								subscribeUser.on('eose', () => {
									subscribeUser.unsub();
								});
							}
						} else {
							newEvents.push(event);
						}
					});
					subscribe.on('eose', () => {
						upToDate = true;
						timeline.events.unshift(...newEvents);
						timeline = timeline;
					});
				});
			});
		});
	}

	async function postNote() {
		const event = await window.nostr.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: 1,
			tags: [],
			content
		});
		console.log(event);

		pool.publish(
			Array.from(relays).map((x) => x.href),
			event
		);

		content = '';
	}

	let reaction: Function = async (note: Event, content = '+') => {
		console.log('[like]', note);

		if (pawPad) {
			content = '🐾';
		}

		const event = await window.nostr.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: 7,
			tags: [
				['e', note.id],
				['p', note.pubkey]
			],
			content
		});
		console.log(event);

		pool.publish(
			Array.from(relays).map((x) => x.href),
			event
		);
	};
</script>

<svelte:head>
	<title>nostter - home</title>
</svelte:head>

<main>
	<h1>home</h1>

	<button on:click={login} disabled={loggedIn}>Login with NIP-07</button>
	<input type="checkbox" bind:checked={pawPad}>🐾

	<form on:submit|preventDefault={postNote}>
		<textarea placeholder="いまどうしてる？" bind:value={content} />
		<input type="submit" value="投稿する" disabled={!loggedIn} />
	</form>

	<TimelineView {timeline} bind:reaction {pawPad} />
</main>

<style>
	textarea {
		width: 500px;
	}
</style>
