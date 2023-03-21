<script lang="ts">
	import { onMount } from 'svelte';
	import type { Event, UserEvent, User } from '../types';
	import TimelineView from '../TimelineView.svelte';
	import { events } from '../../stores/Events';
	import { userEvents, saveUserEvent } from '../../stores/UserEvents';
	import { pawPad } from '../../stores/Preference';
	import { pool } from '../../stores/Pool';
	import { relayUrls, followees, authorProfile } from '../../stores/Author';
	import { goto } from '$app/navigation';

	// past notes
	async function fetchHomeTimeline() {
		const limit = 500;
		const since = Math.floor(Date.now() / 1000 - 24 * 60 * 60);
		const pastEvents = await $pool.list($relayUrls, [
			{
				kinds: [1, 6, 42],
				authors: $followees,
				limit,
				since
			}
		]);

		const pubkeys = new Set(pastEvents.map((x) => x.pubkey));
		const metadataEvents = await $pool.list($relayUrls, [
			{
				kinds: [0],
				authors: Array.from(pubkeys)
			}
		]);
		$userEvents = new Map(
			metadataEvents.map((event) => {
				const user = JSON.parse(event.content);
				const e = {
					...event,
					user
				} as UserEvent;
				return [e.pubkey, e];
			})
		);

		pastEvents.sort((x, y) => y.created_at - x.created_at);

		$events = pastEvents.slice(0, limit / 2).map((event) => {
			const userEvent = $userEvents.get(event.pubkey);
			if (userEvent !== undefined) {
				return {
					...event,
					user: userEvent.user
				} as Event;
			} else {
				console.error(`${event.pubkey} is not found in $userEvents`);
				return event as Event;
			}
		});
	}

	// new notes
	function subscribeHomeTimeline() {
		let lastPastEvent: Event | undefined;
		let newEvents: Event[] = [];
		const subscribe = $pool.sub($relayUrls, [
			{
				kinds: [1, 6, 42],
				authors: Array.from($followees),
				since: $events[0].created_at + 1
			}
		]);
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
	}

	async function fetchUser(pubkey: string): Promise<User> {
		return new Promise((resolve, reject) => {
			const subscribeUser = $pool.sub($relayUrls, [
				{
					kinds: [0],
					authors: [pubkey]
				}
			]);
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

		// Check login
		console.log('[author]', $authorProfile);
		if ($authorProfile === undefined) {
			console.log('Redirect to /');
			await goto('/');
			return;
		}

		if ($events.length > 0) {
			return;
		}

		await fetchHomeTimeline();
		subscribeHomeTimeline();
	});
</script>

<svelte:head>
	<title>nostter - home</title>
</svelte:head>

<h1>home</h1>

<div>
	<input type="checkbox" bind:checked={$pawPad} />🐾
	<span>{$events.length} notes</span>
</div>

<TimelineView events={$events} />

<style>
	@media screen and (max-width: 600px) {
		h1,
		div {
			margin: 0.67em;
		}
	}
</style>
