<script lang="ts">
	import type { Filter } from 'nostr-tools';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { Search } from '$lib/Search';
	import { minTimelineLength } from '$lib/Constants';
	import { EventItem } from '$lib/Items';
	import type { Event } from '../types';
	import TimelineView from '../TimelineView.svelte';
	import SearchForm from './SearchForm.svelte';
	import Trending from './Trending.svelte';

	let query = '';
	let filter: Filter;
	let events: Event[] = [];
	let showLoading = false;

	const search = new Search();

	$: items = events.map((x) => new EventItem(x, x.user as Event | undefined));

	afterNavigate(async () => {
		if (query === $page.url.searchParams.get('q')) {
			return;
		}
		query = $page.url.searchParams.get('q') ?? '';
		events = [];
		console.log('[q]', query);
		filter = search.parseQuery(query);
		await load();
	});

	async function load() {
		if (query === '' || filter === undefined) {
			return;
		}

		showLoading = true;

		let firstLength = events.length;
		let count = 0;
		let until = events.at(events.length - 1)?.created_at ?? Math.floor(Date.now() / 1000);
		let seconds = 24 * 60 * 60;

		while (events.length - firstLength < minTimelineLength && count < 10) {
			filter.until = until;
			filter.since = until - seconds;
			const eventItems = await search.fetch(filter);
			events.push(
				...eventItems.map((x) => {
					return {
						...x.event,
						user: x.metadata?.content
					} as Event;
				})
			);
			events = events;

			until -= seconds;
			seconds *= 2;
			count++;
			console.log('[load]', count, until, seconds / 3600, events.length);
		}

		showLoading = false;
	}
</script>

<svelte:head>
	<title>nostter - {query ? `Search: ${query}` : 'Search'}</title>
</svelte:head>

<h1><a href="/search">Search</a></h1>

<section>
	<SearchForm {query} />
</section>

{#if query === ''}
	<section>
		<Trending />
	</section>
{/if}

<section>
	<TimelineView {items} {load} {showLoading} />
</section>

<style>
	h1 a {
		color: inherit;
		text-decoration: none;
	}

	section + section {
		margin-top: 1rem;
	}

	@media screen and (max-width: 600px) {
		h1 {
			margin: 0.67em;
		}
	}
</style>
