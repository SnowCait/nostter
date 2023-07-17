<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { error } from '@sveltejs/kit';
	import { nip19, Kind } from 'nostr-tools';
	import { readRelays } from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';
	import type { Event as NostrEvent } from '../types';
	import type { EventPointer } from 'nostr-tools/lib/nip19';
	import { Api } from '$lib/Api';
	import { referTags } from '$lib/EventHelper';

	let events: NostrEvent[] = [];
	let eventId = '';
	let relays: string[] = [];

	afterNavigate(async () => {
		console.log('[note page]');

		events = [];

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
		const event = await api.fetchEventById(eventId);
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
		relatedEvents.sort((x, y) => x.event.created_at - y.event.created_at);
		console.log('[#e events]', relatedEvents);

		const repliedEvents = relatedEvents.filter(
			(x) => x.event.kind === Kind.Text && x.event.id !== eventId
		);
		const repostedEvents = relatedEvents.filter((x) => Number(x.event.kind) === 6);
		const reactionEvents = relatedEvents.filter((x) => x.event.kind === Kind.Reaction);
		console.log(repliedEvents, repostedEvents, reactionEvents);

		const { root, reply } = referTags(event);
		let rootId = root?.at(1);
		let replyId = reply?.at(1);
		console.log(rootId, replyId);

		let i = 0;
		while (replyId !== undefined) {
			const replyToEvent = await api.fetchEventItem([
				{
					ids: [replyId]
				}
			]);
			if (replyToEvent !== undefined) {
				events.unshift(replyToEvent.toEvent());
				replyId = referTags(replyToEvent.event).reply?.at(1);
			}
			i++;
			if (i > 20) {
				break;
			}
		}

		if (rootId !== undefined && !events.some((x) => x.id === rootId) && i <= 20) {
			const rootEvent = await $pool.get($readRelays, {
				ids: [rootId]
			});
			if (rootEvent !== null) {
				events.unshift(rootEvent as NostrEvent);
			}
		}

		events.push(...repliedEvents.map((x) => x.toEvent()));
		events = events;
	});
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
