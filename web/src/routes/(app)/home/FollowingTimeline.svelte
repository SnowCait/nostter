<script lang="ts">
	import { onMount } from 'svelte';
	import type { Event } from '../../types';
	import TimelineView from '../TimelineView.svelte';
	import { events, eventsPool } from '../../../stores/Events';
	import { saveMetadataEvent } from '../../../stores/UserEvents';
	import { pool } from '../../../stores/Pool';
	import {
		pubkey,
		author,
		followees,
		authorProfile,
		readRelays,
		updateRelays,
		rom,
		bookmarkEvent,
		writeRelays
	} from '../../../stores/Author';
	import { goto } from '$app/navigation';
	import { Api } from '$lib/Api';
	import { Kind, type Filter, type Event as NostrEvent, type Relay } from 'nostr-tools';
	import { saveLastNotes } from '../../../stores/LastNotes';
	import { Signer } from '$lib/Signer';
	import { filterLimitItems, minTimelineLength, reverseChronologicalItem } from '$lib/Constants';
	import { chunk } from '$lib/Array';
	import { Content } from '$lib/Content';
	import {
		lastReadAt,
		notifiedEventItems,
		unreadEventItems
	} from '../../../stores/Notifications';
	import { EventItem } from '$lib/Items';
	import { Mute } from '$lib/Mute';
	import { autoRefresh } from '../../../stores/Preference';
	import { batch, createRxForwardReq, createRxOneshotReq, latestEach, uniq } from 'rx-nostr';
	import { tap, bufferTime } from 'rxjs';
	import { userStatusesGeneral, userStatusesMusic } from '../../../stores/UserStatuses';
	import { referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import { WebStorage } from '$lib/WebStorage';
	import { findIdentifier } from '$lib/EventHelper';
	import { authorReplaceableKinds } from '$lib/Author';
	import { Timeline } from '$lib/Timeline';
	import { Preferences, preferencesStore } from '$lib/Preferences';

	const now = Math.floor(Date.now() / 1000);
	const streamingSpeed = new Map<number, number>();
	let streamingSpeedNotifiedAt = now;

	const userStatusReq = createRxForwardReq();

	// new notes
	function subscribeHomeTimeline() {
		console.log('Subscribe home timeline');

		let eose = false;
		let newEvents: EventItem[] = [];
		const since = now;

		const followeesFilter = chunk($followees, filterLimitItems).map((chunkedAuthors) => {
			return {
				kinds: [
					Kind.Metadata,
					Kind.Text,
					6,
					Kind.ChannelCreation,
					Kind.ChannelMessage,
					30315
				],
				authors: chunkedAuthors,
				since
			};
		});

		const storage = new WebStorage(localStorage);
		const cachedAt = storage.getCachedAt();
		const authorFilter: Filter = {
			kinds: [...new Set(authorReplaceableKinds.map(({ kind }) => kind))],
			authors: [$pubkey],
			since: cachedAt ?? now
		};
		console.log('[author filter]', authorFilter, new Date((authorFilter.since ?? 0) * 1000));

		const subscribe = $pool.sub($readRelays, [
			...followeesFilter,
			{
				kinds: [
					Kind.Text,
					Kind.EncryptedDirectMessage,
					6,
					Kind.Reaction,
					Kind.ChannelMessage,
					Kind.Zap
				],
				'#p': [$pubkey],
				since
			},
			{
				kinds: [Kind.Reaction],
				authors: [$pubkey],
				since
			},
			authorFilter
		]);
		subscribe.on('event', async (nostrEvent: NostrEvent) => {
			const event = nostrEvent as Event;
			console.debug(event, $pool.seenOn(event.id));

			if (event.kind === Kind.Metadata) {
				if (event.pubkey === $pubkey) {
					storage.setReplaceableEvent(event);
				}
				await saveMetadataEvent(event);
				return;
			}

			if (event.kind === Kind.Contacts) {
				console.log('[contacts]', event, $pool.seenOn(event.id));
				storage.setReplaceableEvent(event);
				return;
			}

			if (event.kind === 10000) {
				console.log('[mute list]', event, $pool.seenOn(event.id));
				storage.setReplaceableEvent(event);
				await new Mute($pubkey, $pool, $writeRelays).update(event);
				return;
			}

			if (event.kind === 10001 || event.kind === 10005) {
				storage.setReplaceableEvent(event);
				return;
			}

			if (event.kind === Kind.RelayList) {
				console.log('[relay list]', event, $pool.seenOn(event.id));
				storage.setReplaceableEvent(event);
				updateRelays(event);
				return;
			}

			if (event.kind === 10030) {
				storage.setReplaceableEvent(event);
				$author?.saveCustomEmojis(event);
				return;
			}

			if (event.kind === 30000) {
				storage.setParameterizedReplaceableEvent(event);
				const identifier = findIdentifier(event.tags);
				if (identifier === 'notifications/lastOpened') {
					console.log('[last read]', event);
					$lastReadAt = event.created_at;
					$unreadEventItems = [];
				} else if (identifier !== undefined) {
					console.log('[people list]', event);
				}
				return;
			}

			if (event.kind === 30001) {
				console.debug('[list]', event, $pool.seenOn(event.id));
				storage.setParameterizedReplaceableEvent(event);
				if (findIdentifier(event.tags) === 'bookmark') {
					console.log('[bookmark]', event, $pool.seenOn(event.id));
					$bookmarkEvent = event;
				}
				return;
			}

			if (event.kind === 30078) {
				console.log('[app data]', event, $pool.seenOn(event.id));
				storage.setParameterizedReplaceableEvent(event);

				const identifier = findIdentifier(event.tags);
				if (identifier === 'nostter-read') {
					console.log('[last read]', event);
					$lastReadAt = event.created_at;
					$unreadEventItems = [];
				} else if (identifier === 'nostter-preferences') {
					const preferences = new Preferences(event.content);
					$preferencesStore = preferences;
				}

				return;
			}

			if (event.kind === 30315) {
				console.log('[user status]', event, $pool.seenOn(event.id));
				if (event.content === '') {
					return;
				}
			}

			referencesReqEmit(event);

			// Cache note events
			const eventIds = new Set([
				...event.tags.filter(([tagName]) => tagName === 'e').map(([, id]) => id),
				...Content.findNotesAndNeventsToIds(event.content)
			]);
			const api = new Api($pool, $readRelays);
			await api.fetchEventsByIds([...eventIds]);

			// Streaming speed (experimental)
			notifyStreamingSpeed(event.created_at);

			const eventItem = new EventItem(event);

			// Notification
			if ($author?.isNotified(event)) {
				console.log('[related]', event);
				$unreadEventItems.unshift(eventItem);
				$notifiedEventItems.unshift(eventItem);
				$unreadEventItems = $unreadEventItems;
				$notifiedEventItems = $notifiedEventItems;

				notify(event);
			}

			if (eose) {
				if ($autoRefresh) {
					$events.unshift(eventItem);
					$events = $events;
				} else {
					$eventsPool.unshift(eventItem);
					$eventsPool = $eventsPool;
				}
			} else {
				newEvents.push(eventItem);
			}

			// Cache
			if (event.kind === Kind.Text) {
				saveLastNotes([event]);
			}

			// User Status
			console.debug('[user status emit]', event.pubkey);
			userStatusReq.emit({
				kinds: [30315],
				authors: [event.pubkey]
			});
		});
		subscribe.on('eose', async () => {
			eose = true;
			if ($autoRefresh) {
				$events.unshift(...newEvents);
				$events = $events;
			} else {
				$eventsPool.unshift(...newEvents);
				$eventsPool = $eventsPool;
			}
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
			relay.on('notice', (message) => {
				console.warn('[notice]', relay.url, message);
			});
			relay.on('error', () => {
				console.error('[error]', relay.url);
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

	async function showPooledEvents() {
		$eventsPool.sort(reverseChronologicalItem);
		$events.unshift(...$eventsPool);
		$events = $events;
		$eventsPool = [];
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

		rxNostr
			.use(userStatusReq.pipe(bufferTime(1000), batch()))
			.pipe(
				uniq(),
				latestEach((packet) => packet.event.pubkey)
			)
			.subscribe((packet) => {
				console.log('[user status]', packet, packet.event.pubkey, packet.event.content);
				const tags: string[][] = packet.event.tags;
				const expiration = tags.find(([tagName]) => tagName === 'expiration')?.at(1);
				if (
					expiration !== undefined &&
					Number(expiration) < Math.floor(Date.now() / 1000)
				) {
					return;
				}
				const identifier = tags.find(([tagName]) => tagName === 'd')?.at(1) ?? '';
				switch (identifier) {
					case 'general': {
						$userStatusesGeneral.push(packet.event);
						$userStatusesGeneral = $userStatusesGeneral;
						break;
					}
					case 'music': {
						$userStatusesMusic.push(packet.event);
						$userStatusesMusic = $userStatusesMusic;
						break;
					}
				}
			});
	});

	async function load() {
		console.log('[rx-nostr home timeline load]', $followees.length, rxNostr.getAllRelayState());

		if ($followees.length === 0) {
			console.warn('Please login');
			return;
		}

		const firstLength = $events.length;
		let count = 0;
		let until =
			$events.length > 0
				? Math.min(...$events.map((item) => item.event.created_at))
				: Math.floor(Date.now() / 1000);
		let seconds = 15 * 60;

		while ($events.length - firstLength < minTimelineLength && count < 12) {
			const since = until - seconds;
			console.log(
				'[rx-nostr home timeline period]',
				new Date(since * 1000),
				new Date(until * 1000)
			);

			const followeesFilters = Timeline.createChunkedFilters($followees, since, until);
			const filters = [
				...followeesFilters,
				{
					kinds: [
						Kind.Text,
						Kind.EncryptedDirectMessage,
						6,
						Kind.Reaction,
						Kind.ChannelMessage,
						Kind.Zap
					],
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
			];

			console.debug('[rx-nostr home timeline REQ]', filters, rxNostr.getAllRelayState());
			const pastChannelMessageReq = createRxOneshotReq({ filters });
			await new Promise<void>((resolve, reject) => {
				rxNostr
					.use(pastChannelMessageReq)
					.pipe(
						uniq(),
						tap(({ event }) => referencesReqEmit(event))
					)
					.subscribe({
						next: async (packet) => {
							console.debug('[rx-nostr home timeline packet]', packet);
							if (
								!(
									since <= packet.event.created_at &&
									packet.event.created_at < until
								)
							) {
								console.warn(
									'[rx-nostr home timeline out of period]',
									packet,
									since,
									until
								);
								return;
							}
							if ($events.some((x) => x.event.id === packet.event.id)) {
								console.warn('[rx-nostr home timeline duplicate]', packet.event);
								return;
							}
							const item = new EventItem(packet.event);
							const index = $events.findIndex(
								(x) => x.event.created_at < item.event.created_at
							);
							if (index < 0) {
								$events.push(item);
							} else {
								$events.splice(index, 0, item);
							}
							$events = $events;

							// Cache
							if (item.event.kind === Kind.Text) {
								saveLastNotes([item.event]);
							}
						},
						complete: () => {
							console.log('[rx-nostr home timeline complete]');

							if ($events.length === 0) {
								return;
							}

							// User Status
							console.debug('[rx-nostr user status emit]');
							userStatusReq.emit({
								kinds: [30315],
								authors: [...new Set($events.map((x) => x.event.pubkey))]
							});

							resolve();
						},
						error: (error) => {
							reject(error);
						}
					});
			});

			until -= seconds;
			seconds *= 2;
			count++;
			console.log(
				'[rx-nostr home timeline loaded]',
				count,
				until,
				seconds / 3600,
				$events.length
			);
		}
	}
</script>

{#if $eventsPool.length > 0}
	<article>
		<button class="clear" on:click={showPooledEvents}>
			Show new events ({$eventsPool.length})
		</button>
	</article>
{/if}

<TimelineView items={$events} {load} />

<style>
	article {
		border: var(--default-border);
		border-bottom: none;
	}

	button {
		width: 100%;
		height: 2rem;
		background-color: rgb(240, 240, 240);
		color: var(--accent-gray);
	}
</style>
