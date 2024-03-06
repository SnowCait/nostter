<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { createRxBackwardReq, uniq } from 'rx-nostr';
	import { filter, tap } from 'rxjs';
	import { browser } from '$app/environment';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import {
		eventTimeouts,
		fetchInterval,
		fetchTimeout,
		firstSince,
		items,
		itemsPool,
		sinceDate,
		speed,
		speeds,
		startedAt,
		subscription
	} from '$lib/timelines/ReplayHomeTimeline';
	import { appName, reverseChronologicalItem } from '$lib/Constants';
	import { EventItem } from '$lib/Items';
	import { Timeline } from '$lib/Timeline';
	import type { PageData } from './$types';
	import { followees } from '../../../../stores/Author';
	import TimelineView from '../../TimelineView.svelte';

	export let data: PageData;

	let localDate: Date | undefined;

	$: if (
		data.since !== null &&
		!Number.isNaN(data.since.getTime()) &&
		(data.since.getTime() !== $sinceDate?.getTime() || data.speed !== $speed)
	) {
		console.log('[replay page]', data.since);
		$sinceDate = data.since;
		$speed = data.speed;

		clear();

		const since = Math.floor(data.since.getTime() / 1000);
		$firstSince = since;
		if (browser) {
			fetchNext(since);
		}
	}

	$: if ($sinceDate !== undefined) {
		localDate = new Date($sinceDate.getTime() - $sinceDate.getTimezoneOffset() * 60 * 1000);
	}

	function clear(): void {
		console.debug('[replay clear]', $subscription, $fetchTimeout, $eventTimeouts);
		$subscription?.unsubscribe();
		$items = [];
		$itemsPool = [];
		$startedAt = undefined;
		clearTimeout($fetchTimeout);
		for (const timeout of $eventTimeouts) {
			clearTimeout(timeout);
		}
	}

	function fetchNext(since: number): void {
		console.log('[replay fetch]', new Date(since * 1000));

		const until = since + fetchInterval;

		const req = createRxBackwardReq();
		$subscription = rxNostr
			.use(req)
			.pipe(
				uniq(),
				filter(({ event }) => since <= event.created_at && event.created_at < until),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
				})
			)
			.subscribe({
				next: (packet) => {
					console.debug('[rx-nostr replay next]', packet);
					const item = new EventItem(packet.event);
					$itemsPool.push(item);
					$itemsPool = $itemsPool;
				},
				complete: () => {
					console.debug('[rx-nostr replay complete]');
					replay(until);
				},
				error: (error) => {
					console.error('[rx-nostr replay error]', error);
					replay(until);
				}
			});

		const followeesFilters = Timeline.createChunkedFilters($followees, since, until);
		req.emit(followeesFilters);
		req.over();
	}

	function replay(until: number): void {
		if ($firstSince === undefined) {
			throw new Error('Logic error');
		}

		if ($startedAt === undefined) {
			$startedAt = Date.now();
		}

		$itemsPool.sort(reverseChronologicalItem);

		while ($itemsPool.length > 0) {
			const item = $itemsPool.pop();
			if (item === undefined) {
				break;
			}
			const offset =
				((item.event.created_at - $firstSince) * 1000) / data.speed -
				(Date.now() - $startedAt);
			console.debug('[replay event]', offset, new Date(Date.now() + offset));
			const timeout = setTimeout(() => {
				$items.unshift(item);
				$items = $items;
			}, offset);
			$eventTimeouts.push(timeout);
		}

		if (until > Math.floor(Date.now() / 1000)) {
			console.log('[replay caught up]');
			return;
		}

		const fetchOffset =
			((until - $firstSince - 120) * 1000) / data.speed - (Date.now() - $startedAt);
		console.debug('[replay next fetch]', fetchOffset, new Date(Date.now() + fetchOffset));
		$fetchTimeout = setTimeout(() => {
			fetchNext(until);
		}, fetchOffset);
	}
</script>

<svelte:head>
	<title>{appName} - {$_('replay.title')}</title>
</svelte:head>

<h1>{$_('replay.title')}</h1>

<form>
	<input type="datetime-local" name="since" value={localDate?.toISOString().slice(0, -1)} />
	<select name="speed">
		{#each speeds as speed}
			<option value={speed} selected={speed === data.speed}>x{speed}</option>
		{/each}
	</select>
	<input type="submit" value={$_('replay.play')} />
</form>

<TimelineView items={$items} showLoading={localDate !== undefined && $items.length === 0} />

<style>
	form {
		margin: 0.5rem auto;
	}
</style>
