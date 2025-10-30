<script lang="ts">
	import { onMount } from 'svelte';
	import { uniq, type LazyFilter, createRxBackwardReq } from 'rx-nostr';
	import { tap } from 'rxjs';
	import { kinds as Kind } from 'nostr-tools';
	import { goto } from '$app/navigation';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { followeesOfFollowees } from '$lib/author/MuteAutomatically';
	import { events, eventsPool } from '$lib/stores/Events';
	import { pubkey, followees } from '$lib/stores/Author';
	import { saveLastNote } from '$lib/stores/LastNotes';
	import { referencesReqEmit, rxNostr, storeSeenOn, tie } from '$lib/timelines/MainTimeline';
	import { hasSubscribed, hometimelineReqEmit } from '$lib/timelines/HomeTimeline';
	import {
		notificationsFilterKinds,
		minTimelineLength,
		reverseChronologicalItem
	} from '$lib/Constants';
	import { fetchMinutes } from '$lib/Helper';
	import { followingHashtags } from '$lib/Interest';
	import { EventItem } from '$lib/Items';
	import { preferencesStore } from '$lib/Preferences';
	import { Timeline } from '$lib/Timeline';
	import { applyTimelieFilter, excludeKinds } from '$lib/TimelineFilter';
	import { userStatusReqEmit, userStatusesMap } from '$lib/UserStatus';
	import TimelineView from '../TimelineView.svelte';
	import { _ } from 'svelte-i18n';
	import { IconAdjustmentsHorizontal } from '@tabler/icons-svelte';
	import { createCollapsible, melt } from '@melt-ui/svelte';
	import { slide } from 'svelte/transition';
	import TimelineFilter from '../preferences/TimelineFilter.svelte';

	const {
		elements: { root, content, trigger },
		states: { open }
	} = createCollapsible();

	$: items = $events.filter(
		(item) =>
			!$excludeKinds.includes(item.event.kind) &&
			(!$preferencesStore.muteAutomatically || $followeesOfFollowees.has(item.event.pubkey))
	);

	async function showPooledEvents() {
		$eventsPool.sort(reverseChronologicalItem);
		$events.unshift(...$eventsPool);
		$events = $events;
		$eventsPool = [];
	}

	onMount(async () => {
		console.log('[home page]');

		if ($followees.length === 0) {
			await goto('/public');
		}

		if (hasSubscribed) {
			return;
		}

		applyTimelieFilter();
		hometimelineReqEmit();
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
		let seconds = fetchMinutes($followees.length) * 60;

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
					kinds: notificationsFilterKinds,
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
					kinds: [Kind.ShortTextNote],
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
						tie,
						uniq(),
						tap(({ event, from }) => {
							referencesReqEmit(event);
							authorActionReqEmit(event);
							if (!userStatusPubkeys.has(event.pubkey)) {
								userStatusPubkeys.add(event.pubkey);
								userStatusReqEmit(event.pubkey);
							}
							storeSeenOn(event.id, from);
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
							if (item.event.kind === Kind.ShortTextNote) {
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

<header use:melt={$root}>
	<div class="title">
		<h1>{$_('layout.header.home')}</h1>
		<button class="clear" use:melt={$trigger}>
			<IconAdjustmentsHorizontal />
		</button>
	</div>
	{#if $open}
		<div use:melt={$content} transition:slide class="filter">
			<TimelineFilter />
		</div>
	{/if}
</header>

{#if $eventsPool.length > 0}
	<article>
		<button class="clear" on:click={showPooledEvents}>
			Show new events ({$eventsPool.length})
		</button>
	</article>
{/if}

<div class="timeline">
	<TimelineView {items} {load} />
</div>

<style>
	header div {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	header div button {
		background: initial;
		color: var(--foreground);
		height: 2rem;
		width: 2rem;
		font-size: 0;
	}

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
