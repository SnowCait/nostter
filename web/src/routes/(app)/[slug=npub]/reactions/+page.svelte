<script lang="ts">
	import { _ } from 'svelte-i18n';
	import TimelineView from '../../TimelineView.svelte';
	import { afterNavigate } from '$app/navigation';
	import { Api } from '$lib/Api';
	import { pool } from '../../../../stores/Pool';
	import { readRelays } from '../../../../stores/Author';
	import { page } from '$app/stores';
	import { error } from '@sveltejs/kit';
	import { User as UserDecoder } from '$lib/User';
	import { Kind, type Filter } from 'nostr-tools';
	import { appName, minTimelineLength } from '$lib/Constants';
	import type { EventItem } from '$lib/Items';

	let pubkey: string;
	let relays: string[];
	let items: EventItem[] = [];
	let showLoading = false;

	afterNavigate(async () => {
		const slug = $page.params.slug;
		console.log('[reactions page]', slug);

		const data = await UserDecoder.decode(slug);

		if (data.pubkey === undefined) {
			error(404);
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

		let firstLength = items.length;
		let count = 0;
		let until = items.at(items.length - 1)?.event.created_at ?? Math.floor(Date.now() / 1000);
		let seconds = 12 * 60 * 60;

		while (items.length - firstLength < minTimelineLength && count < 10) {
			filter.until = until;
			filter.since = until - seconds;

			const eventItems = await api.fetchEventItems([filter]);
			items.push(...eventItems);
			items = items;

			until -= seconds;
			seconds *= 2;
			count++;
			console.log('[load]', count, until, seconds / 3600, items.length);
		}

		showLoading = false;
	}
</script>

<svelte:head>
	<title>{appName} - {$_('pages.reactions')}</title>
</svelte:head>

<h1>{$_('pages.reactions')}</h1>

<TimelineView {items} {load} {showLoading} />
