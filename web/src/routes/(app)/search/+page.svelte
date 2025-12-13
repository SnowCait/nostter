<script lang="ts">
	import type { Filter } from 'nostr-tools';
	import type { Unsubscriber } from 'svelte/store';
	import { _ } from 'svelte-i18n';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { Search } from '$lib/Search';
	import { appName, minTimelineLength } from '$lib/Constants';
	import { followingHashtags } from '$lib/Interest';
	import { EventItem } from '$lib/Items';
	import TimelineView from '../TimelineView.svelte';
	import SearchForm from './SearchForm.svelte';
	import Trending from './Trending.svelte';
	import FollowHashtagButton from '$lib/components/FollowHashtagButton.svelte';
	import UnfollowHashtagButton from '$lib/components/UnfollowHashtagButton.svelte';
	import { unique } from '$lib/Array';
	import { SearchTimeline } from '$lib/timelines/SearchTimeline';
	import { createTabs, melt } from '@melt-ui/svelte';
	import { crossfade } from 'svelte/transition';
	import { cubicInOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	const {
		elements: { root, list, content, trigger },
		states: { value }
	} = createTabs({ defaultValue: 'notes' });

	const triggers = [
		{ id: 'notes', label: $_('search.notes') },
		{ id: 'users', label: $_('search.users') }
	];

	const [send, receive] = crossfade({ duration: 250, easing: cubicInOut });

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
	let showUsersLoading = false;
	let usersSearch: SearchTimeline | undefined;
	let unsubscribe: Unsubscriber | undefined;
	let metadataItems: EventItem[] = [];
	let tabKey = 'notes';

	const search = new Search();

	onMount(() => {
		const unsubscribe = value.subscribe((v) => {
			tabKey = v;
			tabChanged(v);
		});

		return () => {
			unsubscribe();
		};
	});

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

		const {
			fromPubkeys,
			toPubkeys,
			hashtags: _hashtags,
			kinds,
			keyword,
			since,
			until
		} = search.parseQuery(query, mine);
		hashtags = _hashtags;
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

		switch (tabKey) {
			case 'notes': {
				await load();
				break;
			}
			case 'users': {
				initializeUsersSearch();
				break;
			}
		}
	});

	async function load() {
		if (query === '' || filter === undefined || completed || tabKey !== 'notes') {
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

	async function loadUsers(): Promise<void> {
		if (usersSearch === undefined || tabKey !== 'users') {
			return;
		}

		showUsersLoading = true;
		await usersSearch.load();
		showUsersLoading = false;
	}

	async function tabChanged(key: string): Promise<void> {
		switch (key) {
			case 'notes': {
				console.debug('[search notes]', filter);
				if (items.length === 0) {
					await load();
				}
				break;
			}
			case 'users': {
				console.debug('[search users]', filter.search, usersSearch?.items);
				if (filter.search) {
					await initializeUsersSearch();
				}
				break;
			}
		}
	}

	async function initializeUsersSearch() {
		if (usersSearch === undefined) {
			usersSearch = new SearchTimeline({ kinds: [0], search: filter.search });
			unsubscribe = usersSearch.items.subscribe((value) => {
				metadataItems = value;
			});
			await loadUsers();
		} else if (usersSearch.filter.search !== filter.search) {
			unsubscribe?.();
			usersSearch.unsubscribe();
			usersSearch = new SearchTimeline({ kinds: [0], search: filter.search });
			unsubscribe = usersSearch.items.subscribe((value) => {
				metadataItems = value;
			});
			await loadUsers();
		}
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

{#if query === ''}
	<section>
		<Trending />
	</section>
{:else}
	<div use:melt={$root}>
		<div use:melt={$list} class="tabs">
			{#each triggers as triggerItem}
				<button use:melt={$trigger(triggerItem.id)} class="trigger">
					<div>{triggerItem.label}</div>
					{#if $value == triggerItem.id}
						<div
							in:send={{ key: 'trigger' }}
							out:receive={{ key: 'trigger' }}
							class="active"
						></div>
					{/if}
				</button>
			{/each}
		</div>
	</div>
	<section use:melt={$content('notes')}>
		<TimelineView {items} {load} {showLoading} />
	</section>
	{#if filter.search}
		<section use:melt={$content('users')}>
			<TimelineView items={metadataItems} load={loadUsers} showLoading={showUsersLoading} />
		</section>
	{/if}
{/if}

<style>
	h1 a {
		color: inherit;
		text-decoration: none;
	}

	section + section {
		margin-top: 1rem;
	}

	div {
		color: var(--accent);
	}

	:global(button.svelteui-Tab) {
		border-radius: 0;
	}

	@media screen and (max-width: 600px) {
		h1 {
			margin: 0.67em;
		}
	}
</style>
