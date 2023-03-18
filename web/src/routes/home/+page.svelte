<script lang="ts" context="module">
	interface Window {
		// NIP-07
		nostr: any;
	}
	declare var window: Window;
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { Event, UserEvent, User, RelayPermission } from '../types';
	import TimelineView from '../TimelineView.svelte';
	import { events } from '../../stores/Events';
	import { userEvents, saveUserEvent } from '../../stores/UserEvents';
	import { pawPad } from '../../stores/Preference';
	import { pool } from '../../stores/Pool';
	import { defaultRelays } from '../../stores/DefaultRelays';
	import { pubkey, relays, recommendedRelay } from '../../stores/Author';

	let followees: Set<string> = new Set();
	let relaysCreatedAt: number;
	let loggedIn = false;
	let debugMessage = '';

	async function login() {
		if (window.nostr === undefined) {
			debugMessage += 'window.nostr was not found\n';
			console.error('Please setup NIP-07');
			return;
		}

		loggedIn = true;
		sessionStorage.setItem('nostter:login', JSON.stringify(loggedIn));

		const nip07Relays = (await window.nostr.getRelays()) as Map<string, RelayPermission>;
		console.log(nip07Relays);
		if (nip07Relays.size === 0) {
			console.warn('Please register relays on NIP-07');
		}

		const profileRelays = new Set([...Object.keys(nip07Relays), ...$defaultRelays]);
		console.log('[relays for profile]', profileRelays);

		$pubkey = await window.nostr.getPublicKey();
		console.log($pubkey);
		let profileLoaded = false; // Workaround
		const subscribeProfile = $pool.sub(Array.from(profileRelays), [
			{
				kinds: [0, 2, 3, 10002],
				authors: [$pubkey]
			}
		]);
		subscribeProfile.on('event', (event: Event) => {
			console.log(event);

			if (event.kind === 0) {
				const user = JSON.parse(event.content) as User;
				console.log(user);
			}

			if (event.kind === 2) {
				$recommendedRelay = event.content;
				console.log('[recommended relay]', $recommendedRelay);
			}

			if (event.kind === 3) {
				const relaysOfKind3 = new Map<string, RelayPermission>(
					Object.entries(JSON.parse(event.content))
				);
				followees = new Set(event.tags.map((x) => x[1]));
				followees.add($pubkey); // Add myself
				console.log(relaysOfKind3, followees);
				if (relaysCreatedAt === undefined || relaysCreatedAt < event.created_at) {
					relaysCreatedAt = event.created_at;
					$relays = new Set(Array.from(relaysOfKind3.keys()).map((x) => new URL(x)));
				}
				console.log('[kind 3]', relays);
			}

			if (event.kind === 10002) {
				if (relaysCreatedAt === undefined || relaysCreatedAt < event.created_at) {
					relaysCreatedAt = event.created_at;
					$relays = new Set(event.tags.map((x) => new URL(x[1])));
				}
				console.log('[kind 10002]', relays);
			}
		});
		subscribeProfile.on('eose', () => {
			subscribeProfile.unsub();

			// Skip 2nd EOSE
			if (profileLoaded) {
				return;
			}
			profileLoaded = true;

			// past notes
			let initialized = false;
			const limit = 500;
			const since = Math.floor(Date.now() / 1000 - 24 * 60 * 60);
			const subscribeNotes = $pool.sub(
				Array.from($relays).map((x) => x.href),
				[
					{
						kinds: [1, 6, 42],
						authors: Array.from(followees),
						limit,
						since
					}
				]
			);
			subscribeNotes.on('event', (event: Event) => {
				console.log(event);
				if (initialized) {
					$events.unshift(event);
					$events = $events;
				} else {
					$events.push(event);
				}
			});
			subscribeNotes.on('eose', () => {
				subscribeNotes.unsub();

				const pubkeys = new Set($events.map((x) => x.pubkey));

				const subscribeUsers = $pool.sub(
					Array.from($relays).map((x) => x.href),
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
					saveUserEvent(userEvent);
				});
				subscribeUsers.on('eose', () => {
					subscribeUsers.unsub();

					$events.sort((x, y) => y.created_at - x.created_at);
					$events = $events.slice(0, limit / 2);
					initialized = true;

					for (const event of $events) {
						const userEvent = $userEvents.get(event.pubkey);
						if (userEvent === undefined) {
							console.error(`${event.pubkey} is not found in $userEvents`);
							continue;
						}
						event.user = userEvent.user;
					}

					// new notes
					let lastPastEvent: Event | undefined;
					let newEvents: Event[] = [];
					const subscribe = $pool.sub(
						Array.from($relays).map((x) => x.href),
						[
							{
								kinds: [1, 6, 42],
								authors: Array.from(followees),
								limit,
								since: $events[0].created_at + 1
							}
						]
					);
					subscribe.on('event', async (event: Event) => {
						console.log(event);

						const userEvent = $userEvents.get(event.pubkey);
						if (userEvent !== undefined) {
							event.user = userEvent.user;
						} else {
							event.user = await fetchUser(event.pubkey); // not chronological
						}

						if (lastPastEvent !== undefined) {
							if (event.created_at < lastPastEvent.created_at) {
								return;
							}
							$events.unshift(event);
							$events = $events;
						} else {
							newEvents.push(event);
						}
					});
					subscribe.on('eose', () => {
						$events.unshift(...newEvents);
						$events = $events;
						lastPastEvent = $events.at(0);
					});
				});
			});
		});
	}

	async function fetchUser(pubkey: string): Promise<User> {
		return new Promise((resolve, reject) => {
			const subscribeUser = $pool.sub(
				Array.from($relays).map((x) => x.href),
				[
					{
						kinds: [0],
						authors: [pubkey]
					}
				]
			);
			subscribeUser.on('event', (event: Event) => {
				const user = JSON.parse(event.content) as User;
				const userEvent: UserEvent = {
					...event,
					user
				};
				console.log('[user found]', userEvent);
				saveUserEvent(userEvent);
			});
			subscribeUser.on('eose', () => {
				subscribeUser.unsub();

				const userEvent = $userEvents.get(pubkey);
				if (userEvent !== undefined) {
					resolve(userEvent.user);
				} else {
					reject();
				}
			});
		});
	}

	onMount(async () => {
		console.log('onMount');

		const loginSession = sessionStorage.getItem('nostter:login');
		if (loginSession !== null && JSON.parse(loginSession) === true) {
			if ($events.length > 0) {
				loggedIn = true;
			} else {
				await login();
			}
		}
	});
</script>

<svelte:head>
	<title>nostter - home</title>
</svelte:head>

<h1>home</h1>

<div>
	<button on:click={login} disabled={loggedIn}>Login with NIP-07</button>
	<input type="checkbox" bind:checked={$pawPad} />🐾
	<span>{$events.length} notes</span>
</div>
{#if debugMessage}
	<pre>[debug] {debugMessage}</pre>
{/if}

<TimelineView events={$events} />

<style>
	@media screen and (max-width: 600px) {
		h1,
		div {
			margin: 0.67em;
		}
	}
</style>
