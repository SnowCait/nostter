<script lang="ts">
	import type { Filter } from 'nostr-tools';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { Search } from '$lib/Search';
	import { minTimelineLength } from '$lib/Constants';
	import type { EventItem } from '$lib/Items';
	import TimelineView from '../TimelineView.svelte';
	import SearchForm from './SearchForm.svelte';
	import Trending from './Trending.svelte';

	let query = '';
	let filter: Filter;
	let items: EventItem[] = [];
	let showLoading = false;

	const search = new Search();

	afterNavigate(async () => {
		if (query === $page.url.searchParams.get('q')) {
			return;
		}
		query = $page.url.searchParams.get('q') ?? '';
		items = [];
		console.log('[q]', query);
		filter = search.parseQuery(query);
		await load();
	});

	async function load() {
		if (query === '' || filter === undefined) {
			return;
		}

		showLoading = true;

		let firstLength = items.length;
		let count = 0;
		let until = items.at(items.length - 1)?.event.created_at ?? Math.floor(Date.now() / 1000);
		let seconds = 24 * 60 * 60;

		while (items.length - firstLength < minTimelineLength && count < 10) {
			filter.until = until;
			filter.since = until - seconds;
			const eventItems = await search.fetch(filter);
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
