<script lang="ts">
	import { error } from '@sveltejs/kit';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { Timeline } from '$lib/Timeline';
	import { User as UserDecoder } from '$lib/User';
	import TimelineView from '../../TimelineView.svelte';
	import type { Event } from '../../types';
	import { pubkey as authorPubkey } from '../../../stores/Author';
	import { userTimelineEvents as events } from '../../../stores/Events';

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
		timeline = new Timeline(pubkey);
		unsubscribe = await timeline.subscribe();
		await load();
	});

	async function load() {
		if (pubkey === undefined) {
			return;
		}

		const oldestCreatedAt = $events.at($events.length - 1)?.created_at;
		const pastEventItems = await timeline.fetch(
			oldestCreatedAt !== undefined ? oldestCreatedAt - 1 : undefined
		);
		$events.push(
			...pastEventItems.map((x) => {
				return {
					...x.event,
					user: x.metadata?.content
				} as Event;
			})
		);
		$events = $events;
	}
</script>

<TimelineView events={$events} readonly={!$authorPubkey} {load} />
