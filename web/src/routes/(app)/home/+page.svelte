<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { uniq, type LazyFilter, createRxBackwardReq } from 'rx-nostr';
	import { tap } from 'rxjs';
	import { Kind, type Relay } from 'nostr-tools';
	import { goto } from '$app/navigation';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { appName } from '$lib/Constants';
	import { followingHashtags } from '$lib/Interest';
	import { events, eventsPool } from '../../../stores/Events';
	import { pool } from '../../../stores/Pool';
	import { pubkey, followees, rom } from '../../../stores/Author';
	import { saveLastNote } from '../../../stores/LastNotes';
	import { Signer } from '$lib/Signer';
	import { minTimelineLength, reverseChronologicalItem } from '$lib/Constants';
	import { EventItem } from '$lib/Items';
	import { referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import { userStatusReqEmit, userStatusesMap } from '$lib/UserStatus';
	import { hasSubscribed, hometimelineReqEmit } from '$lib/timelines/HomeTimeline';
	import { Timeline } from '$lib/Timeline';
	import HomeTab from '$lib/components/HomeTab.svelte';
	import TimelineView from '../TimelineView.svelte';

	function logRelays() {
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

	async function showPooledEvents() {
		$eventsPool.sort(reverseChronologicalItem);
		$events.unshift(...$eventsPool);
		$events = $events;
		$eventsPool = [];
	}

	onMount(async () => {
		console.log('[home page]');

		if ($followees.length === 0) {
			await goto('/trend');
		}

		if (hasSubscribed) {
			return;
		}

		hometimelineReqEmit();
		logRelays();
	});

	async function load() {
		console.log(
			'[rx-nostr home timeline load]',
			$followees.length,
			rxNostr.getAllRelayStatus()
		);

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
		let seconds = $followees.length < 50 ? 60 * 60 : 15 * 60;

		while ($events.length - firstLength < minTimelineLength && count < 12) {
			const since = until - seconds;
			console.log(
				'[rx-nostr home timeline period]',
				new Date(since * 1000),
				new Date(until * 1000)
			);

			const followeesFilters = Timeline.createChunkedFilters($followees, since, until);
			const authorFilters: LazyFilter[] = [
				{
					kinds: [
						Kind.Text,
						Kind.EncryptedDirectMessage,
						6,
						Kind.Reaction,
						Kind.BadgeAward,
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
			if ($followingHashtags.length > 0) {
				authorFilters.push({
					kinds: [Kind.Text],
					'#t': $followingHashtags,
					until,
					since
				});
			}
			const filters = [...followeesFilters, ...authorFilters];

			console.debug('[rx-nostr home timeline REQ]', filters, rxNostr.getAllRelayStatus());
			const userStatusPubkeys = new Set<string>($userStatusesMap.keys());
			await new Promise<void>((resolve, reject) => {
				const loadTimelineReq = createRxBackwardReq();
				rxNostr
					.use(loadTimelineReq)
					.pipe(
						uniq(),
						tap(({ event }) => {
							referencesReqEmit(event);
							authorActionReqEmit(event);
							if (!userStatusPubkeys.has(event.pubkey)) {
								userStatusPubkeys.add(event.pubkey);
								userStatusReqEmit(event.pubkey);
							}
						})
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
								saveLastNote(item.event);
							}
						},
						complete: () => {
							console.log('[rx-nostr home timeline complete]');
							resolve();
						},
						error: (error) => {
							reject(error);
						}
					});
				loadTimelineReq.emit(filters);
				loadTimelineReq.over();
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

<svelte:head>
	<title>{appName} - {$_('layout.header.home')}</title>
</svelte:head>

<HomeTab selected="home" />

{#if $eventsPool.length > 0}
	<article>
		<button class="clear" on:click={showPooledEvents}>
			Show new events ({$eventsPool.length})
		</button>
	</article>
{/if}

<div class="timeline">
	<TimelineView items={$events} {load} />
</div>

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

	@media screen and (min-width: 601px) {
		.timeline {
			margin-top: 0.75rem;
		}
	}
</style>
