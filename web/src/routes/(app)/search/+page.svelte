<script lang="ts">
	import type { Filter } from 'nostr-tools';
	import { _ } from 'svelte-i18n';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { Search } from '$lib/Search';
	import { appName, minTimelineLength } from '$lib/Constants';
	import { followingHashtags } from '$lib/Interest';
	import type { EventItem } from '$lib/Items';
	import TimelineView from '../TimelineView.svelte';
	import SearchForm from './SearchForm.svelte';
	import Trending from './Trending.svelte';
	import FollowHashtagButton from '$lib/components/FollowHashtagButton.svelte';
	import UnfollowHashtagButton from '$lib/components/UnfollowHashtagButton.svelte';
	import { unique } from '$lib/Array';

	let query = '';
	let mine = false;
	let proxy = false;
	let filter: Filter;
	let sinceFilter: number | undefined;
	let untilFilter: number | undefined;
	let hashtags: string[] = [];
	let items: EventItem[] = [];
	let completed = false;
	let showLoading = false;

	const search = new Search();

	afterNavigate(async () => {
		const params = $page.url.searchParams;
		if (
			query === params.get('q') &&
			mine === params.has('mine') &&
			proxy === params.has('proxy')
		) {
			return;
		}
		console.debug('[search params]', params.toString());

		// `q` contains Filter parameters which is filtered by relays.
		// Other parameters are filtered by client.
		query = params.get('q') ?? '';
		mine = params.has('mine');
		proxy = params.has('proxy');

		items = [];
		completed = false;

		const parsedQuery = search.parseQuery(query, mine);
		const { fromPubkeys, toPubkeys, kinds, keyword, since, until } = parsedQuery;
		hashtags = parsedQuery.hashtags;
		sinceFilter = since;
		untilFilter = until;

		if (kinds.length === 0) {
			kinds.push(1);
		}

		filter = {
			kinds
		};
		if (keyword.length > 0) {
			filter.search = keyword;
		}
		if (fromPubkeys.length > 0) {
			filter.authors = fromPubkeys;
		}
		if (toPubkeys.length > 0) {
			filter['#p'] = toPubkeys;
		}
		if (hashtags.length > 0) {
			filter['#t'] = unique([
				...hashtags,
				...hashtags.map((hashtag) => hashtag.toLowerCase())
			]);
		}
		console.debug('[search filter base]', filter);

		await load();
	});

	async function load() {
		if (query === '' || filter === undefined || completed) {
			return;
		}

		showLoading = true;

		let firstLength = items.length;
		let count = 0;
		let until =
			items.at(items.length - 1)?.event.created_at ??
			untilFilter ??
			Math.floor(Date.now() / 1000);
		let seconds = 24 * 60 * 60;

		while (
			items.length - firstLength < minTimelineLength &&
			count < 10 &&
			(sinceFilter === undefined || until >= sinceFilter)
		) {
			filter.until = until;
			filter.since = until - seconds;
			if (sinceFilter !== undefined && sinceFilter > filter.since) {
				filter.since = sinceFilter;
				completed = true;
			}
			const eventItems = await search.fetch(filter);
			items.push(
				...eventItems
					.filter(
						(item) =>
							proxy ||
							!item.event.tags.some(
								([tagName, , protocol]) =>
									tagName === 'proxy' && !['rss', 'web'].includes(protocol)
							)
					)
					.filter((item) => !items.some((i) => i.id === item.id))
			);
			items = items;

			until -= seconds;
			seconds *= 2;
			count++;
			console.debug('[load]', count, until, seconds / 3600, items.length);
		}

		showLoading = false;
	}
</script>

<svelte:head>
	<title>
		{appName} - {query ? `${$_('layout.header.search')}: ${query}` : $_('layout.header.search')}
	</title>
</svelte:head>

<h1><a href="/search">{$_('layout.header.search')}</a></h1>

<section>
	<SearchForm {query} {mine} />
</section>

{#if query === ''}
	<section>
		<Trending />
	</section>
{/if}

{#if hashtags.length > 0}
	<section>
		{#each hashtags as hashtag}
			{#if $followingHashtags.includes(hashtag)}
				<UnfollowHashtagButton {hashtag} />
			{:else}
				<FollowHashtagButton {hashtag} />
			{/if}
		{/each}
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
