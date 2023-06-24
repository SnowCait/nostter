<script lang="ts">
	import { onMount } from 'svelte';
	import type { Event, UserEvent } from '../types';
	import TimelineView from '../TimelineView.svelte';
	import { events } from '../../stores/Events';
	import { saveMetadataEvent, userEvents } from '../../stores/UserEvents';
	import { pool } from '../../stores/Pool';
	import {
		pubkey,
		author,
		followees,
		authorProfile,
		readRelays,
		writeRelays,
		isMuteEvent,
		updateRelays,
		rom,
		bookmarkEvent
	} from '../../stores/Author';
	import { goto } from '$app/navigation';
	import { Api } from '$lib/Api';
	import { Kind, nip57, type Event as NostrEvent, type Relay } from 'nostr-tools';
	import { saveLastNote } from '../../stores/LastNotes';
	import { Signer } from '$lib/Signer';

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

		const since = (until ?? now) - span;
		const pastEvents = await $pool.list($readRelays, [
			{
				kinds: [Kind.Text, 6, Kind.ChannelCreation, Kind.ChannelMessage],
				authors: $followees,
				until,
				since
			},
			{
				kinds: [Kind.Text, Kind.EncryptedDirectMessage, 6, Kind.Reaction, Kind.Zap],
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

		console.log(`Text events loaded in ${Date.now() / 1000 - now} seconds`);

		// Cache note events
		const eventIds = new Set(
			pastEvents
				.map((x) => x.tags.filter(([tagName]) => tagName === 'e').map(([, id]) => id))
				.flat()
		);
		const api = new Api($pool, $readRelays);
		const noteEventsPromise = api.fetchEventsByIds([...eventIds]);

		const pubkeys = new Set(
			pastEvents
				.map((x) => [
					x.pubkey,
					...x.tags.filter(([tagName]) => tagName === 'p').map(([, pubkey]) => pubkey)
				])
				.flat()
		);
		const metadataEventsPromise = $pool.list($readRelays, [
			{
				kinds: [0],
				authors: Array.from(pubkeys)
			}
		]);

		const [, metadataEvents] = await Promise.all([noteEventsPromise, metadataEventsPromise]);
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
						console.warn('[invalid metadata]', error, event);
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

		// Cache
		for (const event of list) {
			if (event.kind === Kind.Text) {
				saveLastNote(event);
			}
		}

		if ($events.length < 50 && since > 1640962800 /* 2022/01/01 00:00:00 */) {
			await fetchHomeTimeline(since - 1, span * 2);
		}
	}

	// new notes
	function subscribeHomeTimeline() {
		console.log('Subscribe home timeline');

		let eose = false;
		let newEvents: Event[] = [];
		const since = now;
		const subscribe = $pool.sub($readRelays, [
			{
				kinds: [Kind.Metadata, Kind.Text, 6, Kind.ChannelCreation, Kind.ChannelMessage],
				authors: Array.from($followees),
				since
			},
			{
				kinds: [Kind.Text, Kind.EncryptedDirectMessage, 6, Kind.Reaction, Kind.Zap],
				'#p': [$pubkey],
				since
			},
			{
				kinds: [Kind.Reaction, Kind.RelayList, 10030],
				authors: [$pubkey],
				since
			},
			{
				kinds: [30001],
				authors: [$pubkey],
				'#d': ['bookmark'],
				since: $bookmarkEvent === undefined ? now : $bookmarkEvent.created_at + 1
			}
		]);
		subscribe.on('event', async (nostrEvent: NostrEvent) => {
			const event = nostrEvent as Event;
			console.debug(event, $pool.seenOn(event.id));

			if (isMuteEvent(event)) {
				return;
			}

			if (event.kind === Kind.Metadata) {
				await saveMetadataEvent(event);
				return;
			}

			if (event.kind === Kind.RelayList) {
				console.log('[relay list]', event, $pool.seenOn(event.id));
				console.debug('[relays before]', $readRelays, $writeRelays);
				updateRelays(event);
				console.debug('[relays after]', $readRelays, $writeRelays);
				return;
			}

			if (event.kind === 10030) {
				$author.saveCustomEmojis(event);
				return;
			}

			if (
				event.kind === 30001 &&
				event.tags.some(
					([tagName, identifier]) => tagName === 'd' && identifier === 'bookmark'
				)
			) {
				console.log('[bookmark]', event, $pool.seenOn(event.id));
				$bookmarkEvent = event;
				return;
			}

			const api = new Api($pool, $readRelays);
			const userEvent = await api.fetchUserEvent(event.pubkey); // not chronological
			if (userEvent !== undefined) {
				event.user = userEvent.user;
			}

			// Streaming speed (experimental)
			notifyStreamingSpeed(event.created_at);

			// Notification
			if ($author.isRelated(event)) {
				console.log('[related]', event);
				notify(event);
			}

			if (eose) {
				$events.unshift(event);
				$events = $events;
			} else {
				newEvents.push(event);
			}

			// Cache
			if (event.kind === Kind.Text) {
				saveLastNote(event);
			}
		});
		subscribe.on('eose', () => {
			$events.unshift(...newEvents);
			$events = $events;
			eose = true;
		});

		console.debug('_conn', $pool['_conn']);
		Object.entries($pool['_conn'] as { [url: string]: Relay }).map(([, relay]) => {
			relay.on('connect', () => {
				console.log('[connect]', relay.url, relay.status);
				console.time(relay.url);
			});
			relay.on('disconnect', () => {
				console.warn('[disconnect]', relay.url, relay.status);
				console.timeEnd(relay.url);
			});
			relay.on('auth', async (challenge: string) => {
				console.log('[auth challenge]', challenge);

				if ($rom) {
					return;
				}

				const event = await Signer.signEvent({
					created_at: Math.round(Date.now() / 1000),
					kind: Kind.ClientAuth,
					tags: [
						['relay', relay.url],
						['challenge', challenge]
					],
					content: ''
				});
				console.log('[auth event]', event);
				const pub = $pool.publish([relay.url], event);
				pub.on('ok', (relay: string): void => {
					console.log('[auth ok]', relay);
				});
				pub.on('failed', (relay: string): void => {
					console.error('[auth failed]', relay);
				});
			});
		});
	}

	function notify(event: Event): void {
		if (window.Notification === undefined || Notification.permission !== 'granted') {
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

		new Notification(`@${event.user?.name}`, {
			icon: event.user?.picture,
			body
		});
	}

	function notifyStreamingSpeed(createdAt: number): void {
		if (window.Notification === undefined || Notification.permission !== 'granted') {
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

<TimelineView
	events={$events}
	load={async () =>
		await fetchHomeTimeline($events.at($events.length - 1)?.created_at ?? now - 1)}
/>
