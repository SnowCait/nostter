<script lang="ts">
	import { onMount } from 'svelte';
	import type { Event, UserEvent } from '../types';
	import TimelineView from '../TimelineView.svelte';
	import { events } from '../../stores/Events';
	import { saveMetadataEvent, userEvents } from '../../stores/UserEvents';
	import { pool as fastPool } from '../../stores/Pool';
	import { pubkey, relayUrls, followees, authorProfile, isMuteEvent } from '../../stores/Author';
	import { goto } from '$app/navigation';
	import { Api } from '$lib/Api';
	import { Kind, SimplePool, type Event as NostrEvent, nip57 } from 'nostr-tools';
	import { Author } from '$lib/Author';

	const now = Math.floor(Date.now() / 1000);
	const streamingSpeed = new Map<number, number>();
	let streamingSpeedNotifiedAt = now;

	// past notes
	async function fetchHomeTimeline(until?: number, span = 1 * 60 * 60) {
		console.log('Fetch home timeline: followees', $followees.length);

		if ($followees.length === 0) {
			console.log('Please login');
			return;
		}

		console.log(`Fetch in ${Date.now() / 1000 - now} seconds`);

		const pool = new SimplePool();
		const since = (until ?? now) - span;
		const pastEvents = await pool.list($relayUrls, [
			{
				kinds: [Kind.Text, 6, Kind.ChannelCreation, Kind.ChannelMessage],
				authors: $followees,
				until,
				since
			},
			{
				kinds: [Kind.Text, 6, Kind.Reaction, Kind.Zap],
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
		pool.close($relayUrls);

		console.log(`Text events loaded in ${Date.now() / 1000 - now} seconds`);

		const pubkeys = new Set(pastEvents.map((x) => x.pubkey));
		const metadataEvents = await $fastPool.list($relayUrls, [
			{
				kinds: [0],
				authors: Array.from(pubkeys)
			}
		]);
		metadataEvents.sort((x, y) => x.created_at - y.created_at);
		$userEvents = new Map(
			metadataEvents
				.map((event) => {
					try {
						const user = JSON.parse(event.content);
						const e = {
							...event,
							user
						} as UserEvent;
						return [e.pubkey, e];
					} catch (error) {
						console.error('[invalid metadata]', error, event);
						return null;
					}
				})
				.filter((x): x is [string, Event] => x !== null)
		);

		for (const [, e] of $userEvents) {
			nip57.getZapEndpoint(e).then((url) => {
				e.user.zapEndpoint = url;
				console.debug('[metadata]', e.user);
			});
		}

		console.log(`Metadata events loaded in ${Date.now() / 1000 - now} seconds`);

		pastEvents.sort((x, y) => y.created_at - x.created_at);

		console.log(`Sorted in ${Date.now() / 1000 - now} seconds`);

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
		$events.push(...list.filter((x) => !isMuteEvent(x)));
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

		let eose = false;
		let newEvents: Event[] = [];
		const since = $events.length > 0 ? $events[$events.length - 1].created_at + 1 : now;
		const subscribe = $fastPool.sub($relayUrls, [
			{
				kinds: [Kind.Metadata, Kind.Text, 6, Kind.ChannelCreation, Kind.ChannelMessage],
				authors: Array.from($followees),
				since
			},
			{
				kinds: [Kind.Text, 6, Kind.Reaction, Kind.Zap],
				'#p': [$pubkey],
				since
			},
			{
				kinds: [Kind.Reaction],
				authors: [$pubkey],
				since
			}
		]);
		subscribe.on('event', async (nostrEvent: NostrEvent) => {
			const event = nostrEvent as Event;
			console.debug(event);

			if (isMuteEvent(event)) {
				return;
			}

			if (event.kind === Kind.Metadata) {
				await saveMetadataEvent(event);
				return;
			}

			const api = new Api($fastPool, $relayUrls);
			const userEvent = await api.fetchUserEvent(event.pubkey); // not chronological
			if (userEvent !== undefined) {
				event.user = userEvent.user;
			}

			// Streaming speed (experimental)
			notifyStreamingSpeed(event.created_at);

			// Notification
			if (new Author($pubkey).isRelated(event)) {
				console.log('[related]', event);
				notify(event);
			}

			if (eose) {
				$events.unshift(event);
				$events = $events;
			} else {
				newEvents.push(event);
			}
		});
		subscribe.on('eose', () => {
			$events.unshift(...newEvents);
			$events = $events;
			eose = true;
		});
	}

	function notify(event: Event): void {
		if (window.Notification === undefined) {
			return;
		}

		console.log('[notify]', Notification.permission);

		if (Notification.permission !== 'granted') {
			return;
		}

		let body = '';
		switch (event.kind) {
			case Kind.Text: {
				body = event.content;
				break;
			}
			case 6: {
				body = 'Repost';
				break;
			}
			case Kind.Reaction: {
				body = event.content.replace('+', 'Like').replace('-', 'Dislike');
				break;
			}
			case Kind.Zap: {
				body = 'Zap';
				break;
			}
			default:
				break;
		}

		new Notification(`@${event?.user.name}`, {
			icon: event.user.picture,
			body
		});
	}

	function notifyStreamingSpeed(createdAt: number): void {
		if (window.Notification === undefined) {
			return;
		}

		console.log('[notify]', Notification.permission);

		if (Notification.permission !== 'granted') {
			return;
		}

		const time = Math.floor(createdAt / 60);
		let count = streamingSpeed.get(time);
		count = (count ?? 0) + 1;
		streamingSpeed.set(time, count);

		const last5minutes = [
			streamingSpeed.get(time - 1) ?? 0,
			streamingSpeed.get(time - 2) ?? 0,
			streamingSpeed.get(time - 3) ?? 0,
			streamingSpeed.get(time - 4) ?? 0,
			streamingSpeed.get(time - 5) ?? 0
		];
		const average = last5minutes.reduce((x, y) => x + y) / last5minutes.length;
		console.debug('[speed]', time, count, average, streamingSpeed, last5minutes);

		if (
			count > average * 2 &&
			count > 10 &&
			createdAt > streamingSpeedNotifiedAt + last5minutes.length * 60
		) {
			streamingSpeedNotifiedAt = createdAt;
			new Notification('Hot timeline!');
		}
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

<TimelineView
	events={$events}
	load={async () =>
		await fetchHomeTimeline($events.at($events.length - 1)?.created_at ?? now - 1)}
/>

<style>
	@media screen and (max-width: 600px) {
		h1 {
			margin: 0.67em;
		}
	}
</style>
