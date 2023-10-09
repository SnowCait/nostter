<script lang="ts">
	import { Kind } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { batch, createRxBackwardReq, createRxOneshotReq, latestEach } from 'rx-nostr';
	import { tap, bufferTime, firstValueFrom, EmptyError } from 'rxjs';
	import { afterNavigate } from '$app/navigation';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { cachedEvents, getCachedEventItem, metadataEvents } from '$lib/cache/Events';
	import { error } from '@sveltejs/kit';
	import type { PageData } from './$types';
	import { author, readRelays } from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';
	import { Api } from '$lib/Api';
	import { referTags } from '$lib/EventHelper';
	import { EventItem, Metadata } from '$lib/Items';
	import Counter from './Counter.svelte';
	import ProfileIconList from './ProfileIconList.svelte';
	import { chronologicalItem } from '$lib/Constants';
	import { tick } from 'svelte';
	import MuteButton from '../action/MuteButton.svelte';

	export let data: PageData;

	$: {
		console.debug('[thread page data]', data);
		eventId = data.eventId;
		relays = data.relays;
	}

	let focusedElement: HTMLDivElement | undefined;

	let item: EventItem | undefined;
	let items: EventItem[] = [];
	let eventId: string | undefined;
	let rootId: string | undefined;
	let relays: string[] = [];

	$: metadataEvent = item !== undefined ? metadataEvents.get(item.event.pubkey) : undefined;
	$: metadata = metadataEvent !== undefined ? new Metadata(metadataEvent) : undefined;

	let repostEvents: EventItem[] | undefined;
	let reactionEvents: EventItem[] | undefined;

	// TODO: Replace
	$: pastItems = items.filter((x) => x.event.created_at < (item?.event.created_at ?? 0));
	$: focusedItems = items.filter((x) => x.event.created_at === (item?.event.created_at ?? 0));
	$: futureItems = items.filter((x) => x.event.created_at > (item?.event.created_at ?? 0));

	$: repostMetadataList =
		repostEvents !== undefined
			? repostEvents
					.map((x) => metadataEvents.get(x.event.pubkey))
					.filter((x): x is Event => x !== undefined)
					.map((x) => new Metadata(x))
			: [];
	$: reactionMetadataList =
		reactionEvents !== undefined
			? reactionEvents
					.map((x) => metadataEvents.get(x.event.pubkey))
					.filter((x): x is Event => x !== undefined)
					.map((x) => new Metadata(x))
			: [];

	const metadataReq = createRxBackwardReq();
	rxNostr
		.use(metadataReq.pipe(bufferTime(500, null, 10), batch()))
		.pipe(latestEach(({ event }: { event: Event }) => event.pubkey))
		.subscribe(async (packet) => {
			const cache = metadataEvents.get(packet.event.pubkey);
			if (cache === undefined || cache.created_at < packet.event.created_at) {
				metadataEvents.set(packet.event.pubkey, packet.event);
			}
		});

	afterNavigate(async () => {
		console.log('[thread page after navigate]', eventId, relays);

		if (eventId === undefined) {
			throw error(500, 'Internal Server Error');
		}

		clear();

		if (rxNostr.getRelays().length === 0) {
			await rxNostr.switchRelays($readRelays);
		}

		for (const relay of relays) {
			await rxNostr.addRelay({ url: relay, read: true, write: false });
		}

		item = getCachedEventItem(eventId);
		if (item === undefined) {
			const eventReq = createRxOneshotReq({
				filters: [
					{
						ids: [eventId]
					}
				]
			});
			try {
				const packet = await firstValueFrom(
					rxNostr.use(eventReq).pipe(
						tap(({ event }: { event: Event }) => {
							console.log('[thread page metadata req]', event);
							metadataReq.emit({
								kinds: [0],
								authors: [event.pubkey],
								limit: 1
							});
						})
					)
				);
				console.log('[thread page event]', packet);
				item = new EventItem(packet.event, metadataEvents.get(packet.event.pubkey));
				cachedEvents.set(packet.event.id, packet.event);
			} catch (error) {
				if (!(error instanceof EmptyError)) {
					throw error;
				}
			}
		}

		if (item === undefined) {
			throw error(404, 'Not Found');
		}

		items.push(item);
		items = items;

		await tick();
		focusedElement?.scrollIntoView();

		const api = new Api($pool, [...new Set([...$readRelays, ...relays])]);
		api.fetchEventItems([
			{
				'#e': [eventId]
			}
		]).then((relatedEvents) => {
			relatedEvents.sort(chronologicalItem);
			console.log('[#e events]', relatedEvents);

			const repliedEvents = relatedEvents.filter(
				(x) => x.event.kind === Kind.Text && x.event.id !== eventId
			);
			repostEvents = relatedEvents.filter((x) => Number(x.event.kind) === 6);
			reactionEvents = relatedEvents.filter((x) => x.event.kind === Kind.Reaction);
			console.log(repliedEvents, repostEvents, reactionEvents);

			items.push(...repliedEvents);
			items = items;
		});

		const { root, reply } = referTags(item.event);
		rootId = root?.at(1);
		let replyId = reply?.at(1);
		console.log(rootId, replyId);

		let i = 0;
		while (replyId !== undefined) {
			const replyToEvent = await api.fetchEventItemById(replyId);
			if (replyToEvent !== undefined) {
				items.unshift(replyToEvent);
				items = items;
				replyId = referTags(replyToEvent.event).reply?.at(1);
			}
			i++;
			if (i > 20) {
				break;
			}
		}

		if (rootId !== undefined && !items.some((x) => x.event.id === rootId) && i <= 20) {
			const rootEvent = await api.fetchEventItemById(rootId);
			if (rootEvent !== undefined) {
				items.unshift(rootEvent);
				items = items;
			}
		}

		await tick();
		focusedElement?.scrollIntoView();
	});

	function clear() {
		items = [];
		repostEvents = undefined;
		reactionEvents = undefined;
	}
</script>

<svelte:head>
	<title>nostter - thread</title>
</svelte:head>

<h1>Thread</h1>

<TimelineView
	items={pastItems}
	readonly={false}
	load={async () => console.debug()}
	showLoading={false}
/>

<div bind:this={focusedElement}>
	<!-- TODO: Replace to EventComponent (Using TimelineView for CSS now) -->
	<TimelineView
		items={focusedItems}
		readonly={false}
		load={async () => console.debug()}
		showLoading={false}
		full={true}
		transitionable={false}
	/>
</div>

<TimelineView
	items={futureItems}
	readonly={false}
	load={async () => console.debug()}
	showLoading={false}
/>

{#if repostEvents !== undefined}
	<Counter label={'Reposts'} count={repostEvents.length} />
	<ProfileIconList metadataList={repostMetadataList} />
{/if}
{#if reactionEvents !== undefined}
	<Counter label={'Reactions'} count={reactionEvents.length} />
	<ProfileIconList metadataList={reactionMetadataList} />
{/if}
{#if $author !== undefined && item !== undefined}
	<div class="mute">
		<MuteButton tagName="e" tagContent={rootId === undefined ? item.event.id : rootId} />
		<span>Mute this thread</span>
	</div>
	<div class="mute">
		<MuteButton tagName="p" tagContent={item.event.pubkey} />
		<span>Mute @{metadata?.content?.name}</span>
	</div>
{/if}

<style>
	.mute {
		margin-top: 16px;
		display: flex;
		flex-direction: row;
	}

	.mute span {
		margin-left: 0.5rem;
	}
</style>
