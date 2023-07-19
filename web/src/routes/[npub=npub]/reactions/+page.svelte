<script lang="ts">
	import TimelineView from '../../TimelineView.svelte';
	import { afterNavigate } from '$app/navigation';
	import { Api } from '$lib/Api';
	import { pool } from '../../../stores/Pool';
	import { readRelays } from '../../../stores/Author';
	import { page } from '$app/stores';
	import { error } from '@sveltejs/kit';
	import { User as UserDecoder } from '$lib/User';
	import { Kind, type Filter } from 'nostr-tools';
	import type { Event } from '../../types';
	import { minTimelineLength } from '$lib/Constants';

	let pubkey: string;
	let relays: string[];
	let events: Event[] = [];
	let showLoading = false;

	afterNavigate(async () => {
		const slug = $page.params.npub;
		console.log('[reactions page]', slug);

		const data = await UserDecoder.decode(slug);

		if (data.pubkey === undefined) {
			throw error(404);
		}

		if (pubkey === data.pubkey) {
			return;
		}

		pubkey = data.pubkey;
		relays = data.relays;

		await load();
	});

	async function load() {
		if (pubkey === undefined) {
			return;
		}

		showLoading = true;

		const filter: Filter = {
			kinds: [Kind.Reaction],
			authors: [pubkey]
		};
		const api = new Api($pool, [...new Set([...$readRelays, ...relays])]);

		let firstLength = events.length;
		let count = 0;
		let until = events.at(events.length - 1)?.created_at ?? Math.floor(Date.now() / 1000);
		let seconds = 12 * 60 * 60;

		while (events.length - firstLength < minTimelineLength && count < 10) {
			filter.until = until;
			filter.since = until - seconds;

			const eventItems = await api.fetchEventItems([filter]);
			events.push(...(await Promise.all(eventItems.map(async (x) => await x.toEvent()))));
			events = events;

			until -= seconds;
			seconds *= 2;
			count++;
			console.log('[load]', count, until, seconds / 3600, events.length);
		}

		showLoading = false;
	}
</script>

<h1>Reactions</h1>

<TimelineView {events} {load} {showLoading} />
