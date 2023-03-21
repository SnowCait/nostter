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
	import { Api } from '$lib/Api';

	const now = Math.floor(Date.now() / 1000);

	// past notes
	async function fetchHomeTimeline(until?: number, span = 1 * 60 * 60) {
		console.log('Fetch home timeline: followees', $followees.length);

		if ($followees.length === 0) {
			console.log('Please login');
			return;
		}

		const since = (until ?? now) - span;
		const pastEvents = await $pool.list($relayUrls, [
			{
				kinds: [1, 6, 42],
				authors: $followees,
				until,
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

		const list = pastEvents.map((event) => {
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
		$events.push(...list);
		$events = $events;
		console.log(
			`Fetch home timeline completed: ${$events.length} events in ${
				Date.now() / 1000 - now
			} seconds`
		);

		if ($events.length < 50 && since > 1640962800 /* 2022/01/01 00:00:00 */) {
			await fetchHomeTimeline(since - 1, span * 2);
		}
	}

	// new notes
	function subscribeHomeTimeline() {
		console.log('Subscribe home timeline');

		let lastPastEvent: Event | undefined;
		let newEvents: Event[] = [];
		const subscribe = $pool.sub($relayUrls, [
			{
				kinds: [1, 6, 42],
				authors: Array.from($followees),
				since: now
			}
		]);
		subscribe.on('event', async (event: Event) => {
			console.debug(event);

			const api = new Api($pool, $relayUrls);
			const userEvent = await api.fetchUserEvent(event.pubkey); // not chronological
			if (userEvent !== undefined) {
				event.user = userEvent.user;
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

<TimelineView
	events={$events}
	load={async () =>
		await fetchHomeTimeline($events.at($events.length - 1)?.created_at ?? now - 1)}
/>

<style>
	@media screen and (max-width: 600px) {
		h1,
		div {
			margin: 0.67em;
		}
	}
</style>
