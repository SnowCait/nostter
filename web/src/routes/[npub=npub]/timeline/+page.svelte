<script lang="ts">
	import { error } from '@sveltejs/kit';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { Timeline } from '$lib/Timeline';
	import { Api } from '$lib/Api';
	import { User as UserDecoder } from '$lib/User';
	import TimelineView from '../../TimelineView.svelte';
	import type { Event } from '../../types';
	import {
		pubkey as authorPubkey,
		followees as authorFollowees,
		readRelays
	} from '../../../stores/Author';
	import { userTimelineEvents as events } from '../../../stores/Events';
	import { SimplePool } from 'nostr-tools';
	import { minTimelineLength } from '$lib/Constants';

	let pubkey: string;
	let timeline: Timeline;
	let unsubscribe: () => void;

	afterNavigate(async () => {
		const slug = $page.params.npub;
		console.log('[timeline page]', slug);

		const data = await UserDecoder.decode(slug);
		console.log('[data]', data);

		if (data.pubkey === undefined) {
			throw error(404);
		}

		if (pubkey === data.pubkey) {
			return;
		}

		pubkey = data.pubkey;
		$events = [];
		if (unsubscribe !== undefined) {
			unsubscribe();
		}
		const followees =
			pubkey === $authorPubkey
				? $authorFollowees
				: await new Api(new SimplePool(), $readRelays).fetchFollowees(pubkey);
		timeline = new Timeline(pubkey, followees);
		unsubscribe = await timeline.subscribe();
		await load();
	});

	async function load() {
		if (timeline === undefined) {
			return;
		}

		let firstLength = $events.length;
		let count = 0;
		let until = $events.at($events.length - 1)?.created_at ?? Math.floor(Date.now() / 1000);
		let seconds = 1 * 60 * 60;

		while ($events.length - firstLength < minTimelineLength && count < 10) {
			const pastEventItems = await timeline.fetch(until, seconds);
			$events.push(
				...pastEventItems.map((x) => {
					return {
						...x.event,
						user: x.metadata?.content
					} as Event;
				})
			);
			$events = $events;

			until -= seconds;
			seconds *= 2;
			count++;
			console.log('[load]', count, until, seconds / 3600, $events.length);
		}
	}
</script>

<TimelineView events={$events} readonly={!$authorPubkey} {load} />
