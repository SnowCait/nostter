<script lang="ts">
	import { Kind } from 'nostr-tools';
	import { afterNavigate } from '$app/navigation';
	import { error } from '@sveltejs/kit';
	import type { PageData } from './$types';
	import { author, readRelays } from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';
	import { Api } from '$lib/Api';
	import { referTags } from '$lib/EventHelper';
	import type { EventItem, Metadata } from '$lib/Items';
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
	let eventId = '';
	let rootId: string | undefined;
	let relays: string[] = [];

	let repostEvents: EventItem[] | undefined;
	let reactionEvents: EventItem[] | undefined;

	// TODO: Replace
	$: pastItems = items.filter((x) => x.event.created_at < (item?.event.created_at ?? 0));
	$: focusedItems = items.filter((x) => x.event.created_at === (item?.event.created_at ?? 0));
	$: futureItems = items.filter((x) => x.event.created_at > (item?.event.created_at ?? 0));

	$: repostMetadataList =
		repostEvents !== undefined
			? repostEvents.map((x) => x.metadata).filter((x): x is Metadata => x !== undefined)
			: [];
	$: reactionMetadataList =
		reactionEvents !== undefined
			? reactionEvents.map((x) => x.metadata).filter((x): x is Metadata => x !== undefined)
			: [];

	afterNavigate(async () => {
		console.log('[thread page after navigate]', eventId, relays);

		clear();

		const api = new Api($pool, [...new Set([...$readRelays, ...relays])]);
		item = await api.fetchEventItemById(eventId);
		if (item === undefined) {
			throw error(404);
		}
		items.push(item);
		items = items;

		await tick();
		focusedElement?.scrollIntoView();

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
		<MuteButton tagName="e" tagContent={rootId === undefined ? eventId : rootId} />
		<span>Mute this thread</span>
	</div>
	<div class="mute">
		<MuteButton tagName="p" tagContent={item.event.pubkey} />
		<span>Mute @{item.metadata?.content?.name}</span>
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
