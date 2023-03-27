<script lang="ts">
	import type { Event, UserEvent } from '../../types';
	import TimelineView from '../../TimelineView.svelte';
	import { userEvents } from '../../../stores/UserEvents';
	import { pool } from '../../../stores/Pool';
	import { pubkey, relayUrls, followees } from '../../../stores/Author';
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Kind } from 'nostr-tools';
	import Calendar from '../Calendar.svelte';

	const now = Date.now() / 1000;
	const dateString = $page.params.date;
	const date = new Date(dateString);
	let events: Event[] = [];

	async function fetchHomeTimeline(since: number, span = 1 * 60 * 60) {
		console.log(`Fetch home timeline: since ${new Date(since * 1000).toString()}`);

		if ($followees.length === 0) {
			console.log('Please login');
			return;
		}

		const until = since + span - 1;
		const pastEvents = await $pool.list($relayUrls, [
			{
				kinds: [Kind.Text, 6, Kind.ChannelMessage],
				authors: $followees,
				until,
				since
			},
			{
				kinds: [Kind.Text, 6, Kind.Reaction],
				'#p': [$pubkey],
				until,
				since
			},
			{
				kinds: [Kind.Reaction],
				authors: [$pubkey],
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
		events.push(...list);
		events = events;
		console.log(
			`Fetch home timeline completed: since ${new Date(since * 1000).toString()}, ${
				events.length
			} events in ${Date.now() / 1000 - now} seconds`
		);
	}

	afterNavigate(async () => {
		// Check login
		console.log('[followees]', $followees.length);
		if ($followees.length === 0) {
			console.log('Redirect to /');
			await goto('/');
			return;
		}

		// TODO: Break when navigated in calendar
		events = [];
		for (const i of [...Array(24).keys()].reverse()) {
			date.setHours(i);
			console.log(date.toString());
			await fetchHomeTimeline(date.getTime() / 1000);
		}
	});
</script>

<svelte:head>
	<title>nostter - home ({date.toLocaleDateString()})</title>
</svelte:head>

<h1>home ({date.toLocaleDateString()})</h1>

<div>
	<Calendar date={dateString} />
</div>

<TimelineView {events} load={async () => console.debug()} createdAtFormat={'time'} />

<style>
	@media screen and (max-width: 600px) {
		h1,
		div {
			margin: 0.67em;
		}
	}
</style>
