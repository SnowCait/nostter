<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { error } from '@sveltejs/kit';
	import { nip19, Kind, type Event } from 'nostr-tools';
	import { readRelays } from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';
	import type { Event as NostrEvent } from '../types';
	import type { EventPointer } from 'nostr-tools/lib/nip19';

	let events: NostrEvent[] = [];
	let eventId = '';

	afterNavigate(async () => {
		console.log('afterNavigate');

		events = [];

		const slug = $page.params.note;
		console.log(slug);
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
				break;
			}
			default: {
				throw error(500);
			}
		}

		const relatedEvents = await $pool.list($readRelays, [
			{
				ids: [eventId]
			},
			{
				'#e': [eventId]
			}
		]);

		console.log(relatedEvents);
		const originalEvent = relatedEvents.find((x) => x.id === eventId) as NostrEvent;
		console.log('[original]', originalEvent);
		if (originalEvent === undefined) {
			throw error(404);
		}
		const repliedEvents = relatedEvents.filter(
			(x) => x.kind === Kind.Text && x.id !== eventId
		) as NostrEvent[];
		const repostedEvents = relatedEvents.filter((x) => Number(x.kind) === 6) as NostrEvent[];
		const reactionEvents = relatedEvents.filter(
			(x) => x.kind === Kind.Reaction
		) as NostrEvent[];
		console.log(repliedEvents, repostedEvents, reactionEvents);

		let [rootEventId, replyToEventId] = referToEvents(originalEvent);
		console.log(rootEventId, replyToEventId);

		let i = 0;
		while (replyToEventId !== undefined) {
			const replyToEvent = await $pool.get($readRelays, {
				ids: [replyToEventId]
			});
			if (replyToEvent !== null) {
				events.unshift(replyToEvent as NostrEvent);
				[, replyToEventId] = referToEvents(replyToEvent);
			}
			i++;
			if (i > 20) {
				break;
			}
		}

		if (rootEventId !== undefined && !events.some((x) => x.id === rootEventId) && i <= 20) {
			const rootEvent = await $pool.get($readRelays, {
				ids: [rootEventId]
			});
			if (rootEvent !== null) {
				events.unshift(rootEvent as NostrEvent);
			}
		}

		events.push(originalEvent);
		events.push(...repliedEvents);

		const pubkeys = Array.from(new Set(events.map((x) => x.pubkey)));
		const userEvents = await $pool.list($readRelays, [
			{
				kinds: [0],
				authors: pubkeys
			}
		]);

		const userEventsMap = new Map(userEvents.map((x) => [x.pubkey, x]));

		for (const event of events) {
			const userEvent = userEventsMap.get(event.pubkey);
			if (userEvent === undefined) {
				console.error(`${nip19.npubEncode(event.pubkey)} not found`);
				continue;
			}
			event.user = JSON.parse(userEvent.content);
		}

		events = events;
	});

	function referToEvents(originalEvent: Event) {
		let rootEventId = originalEvent.tags
			.find(([tagName, , , marker]) => tagName === 'e' && marker === 'root')
			?.at(1);
		let replyToEventId = originalEvent.tags
			.find(([tagName, , , marker]) => tagName === 'e' && marker === 'reply')
			?.at(1);
		console.log(rootEventId, replyToEventId);

		// Deprecated NIP-10
		if (rootEventId === undefined && replyToEventId === undefined) {
			const eTags = originalEvent.tags.filter((tag) => tag.at(0) === 'e' && tag.length < 4);
			if (eTags.length === 1) {
				replyToEventId = eTags[0].at(1);
			} else if (eTags.length > 1) {
				rootEventId = eTags[0].at(1);
				replyToEventId = eTags[eTags.length - 1].at(1);
			}
		}

		return [rootEventId, replyToEventId];
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
