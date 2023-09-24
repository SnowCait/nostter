<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { error } from '@sveltejs/kit';
	import { nip19, Kind } from 'nostr-tools';
	import { author, readRelays } from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';
	import type { Event as NostrEvent } from '../types';
	import type { EventPointer } from 'nostr-tools/lib/nip19';
	import { Api } from '$lib/Api';
	import { referTags } from '$lib/EventHelper';
	import type { EventItem, Metadata } from '$lib/Items';
	import Counter from './Counter.svelte';
	import ProfileIconList from './ProfileIconList.svelte';
	import { chronologicalItem } from '$lib/Constants';
	import { setContext } from 'svelte';
	import MuteButton from '../action/MuteButton.svelte';

	let event: NostrEvent | undefined;
	let events: NostrEvent[] = [];
	let eventId = '';
	let rootId: string | undefined;
	let relays: string[] = [];

	let repostEvents: EventItem[] | undefined;
	let reactionEvents: EventItem[] | undefined;

	$: repostMetadataList =
		repostEvents !== undefined
			? repostEvents.map((x) => x.metadata).filter((x): x is Metadata => x !== undefined)
			: [];
	$: reactionMetadataList =
		reactionEvents !== undefined
			? reactionEvents.map((x) => x.metadata).filter((x): x is Metadata => x !== undefined)
			: [];

	setContext('timeline-config', {
		fullMenu: true
	});

	afterNavigate(async () => {
		console.log('[note page]');

		clear();

		const slug = $page.params.note;
		console.log(slug);
		try {
			const { type, data } = nip19.decode(slug);
			console.log('[decode]', type, data);

			switch (type) {
				case 'note': {
					eventId = data as string;
					break;
				}
				case 'nevent': {
					const pointer = data as EventPointer;
					eventId = pointer.id;
					relays = pointer.relays ?? [];
					break;
				}
				default: {
					throw error(500);
				}
			}
		} catch (e) {
			console.error('[decode error]', e);
			throw error(404);
		}

		const api = new Api($pool, [...new Set([...$readRelays, ...relays])]);
		event = await api.fetchEventById(eventId);
		if (event === undefined) {
			throw error(404);
		}
		events.push(event);
		events = events;

		const relatedEvents = await api.fetchEventItems([
			{
				'#e': [eventId]
			}
		]);
		relatedEvents.sort(chronologicalItem);
		console.log('[#e events]', relatedEvents);

		const repliedEvents = relatedEvents.filter(
			(x) => x.event.kind === Kind.Text && x.event.id !== eventId
		);
		repostEvents = relatedEvents.filter((x) => Number(x.event.kind) === 6);
		reactionEvents = relatedEvents.filter((x) => x.event.kind === Kind.Reaction);
		console.log(repliedEvents, repostEvents, reactionEvents);

		const { root, reply } = referTags(event);
		rootId = root?.at(1);
		let replyId = reply?.at(1);
		console.log(rootId, replyId);

		let i = 0;
		while (replyId !== undefined) {
			const replyToEvent = await api.fetchEventItemById(replyId);
			if (replyToEvent !== undefined) {
				events.unshift(await replyToEvent.toEvent());
				events = events;
				replyId = referTags(replyToEvent.event).reply?.at(1);
			}
			i++;
			if (i > 20) {
				break;
			}
		}

		if (rootId !== undefined && !events.some((x) => x.id === rootId) && i <= 20) {
			const rootEvent = await api.fetchEventItemById(rootId);
			if (rootEvent !== undefined) {
				events.unshift(await rootEvent.toEvent());
				events = events;
			}
		}

		events.push(...(await Promise.all(repliedEvents.map(async (x) => await x.toEvent()))));
		events = events;
	});

	function clear() {
		events = [];
		repostEvents = undefined;
		reactionEvents = undefined;
	}
</script>

<svelte:head>
	<title>nostter - note</title>
</svelte:head>

<h1>note</h1>

<TimelineView
	{events}
	readonly={false}
	focusEventId={eventId}
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
{#if $author !== undefined && event !== undefined}
	<div class="mute">
		<MuteButton tagName="e" tagContent={rootId === undefined ? eventId : rootId} />
		<span>Mute this thread</span>
	</div>
	<div class="mute">
		<MuteButton tagName="p" tagContent={event.pubkey} />
		<span>Mute @{event.user?.name}</span>
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
