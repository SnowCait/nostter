<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { Timeline } from '$lib/Timeline';
	import { Api } from '$lib/Api';
	import TimelineView from '../../TimelineView.svelte';
	import {
		pubkey as authorPubkey,
		followees as authorFollowees,
		readRelays
	} from '../../../stores/Author';
	import { userTimelineEvents as items } from '../../../stores/Events';
	import { SimplePool } from 'nostr-tools';
	import { minTimelineLength } from '$lib/Constants';

	export let pubkey: string;
	let timeline: Timeline;
	let unsubscribe: () => void;

	afterNavigate(async () => {
		$items = [];
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

		let firstLength = $items.length;
		let count = 0;
		let until = $items.at($items.length - 1)?.event.created_at ?? Math.floor(Date.now() / 1000);
		let seconds = 1 * 60 * 60;

		while ($items.length - firstLength < minTimelineLength && count < 10) {
			const pastEventItems = await timeline.fetch(until, seconds);
			$items.push(...pastEventItems);
			$items = $items;

			until -= seconds;
			seconds *= 2;
			count++;
			console.log('[load]', count, until, seconds / 3600, $items.length);
		}
	}
</script>

<TimelineView items={$items} readonly={!$authorPubkey} {load} />
