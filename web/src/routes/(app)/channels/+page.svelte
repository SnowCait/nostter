<script lang="ts">
	import { createRxOneshotReq, filterKind, latestEach, uniq } from 'rx-nostr';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import {
		authorChannelsEventStore,
		cachedEvents,
		channelMetadataEventsStore
	} from '$lib/cache/Events';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { filterTags, findChannelId } from '$lib/EventHelper';
	import { EventItem } from '$lib/Items';
	import TimelineView from '../TimelineView.svelte';
	import { appName } from '$lib/Constants';
	import ExternalLink from '$lib/components/ExternalLink.svelte';

	let channelIds = new Set<string>();
	let keyword = '';

	$: items = [...channelIds]
		.map((channelId) => {
			const event = cachedEvents.get(channelId);
			if (event !== undefined) {
				return new EventItem(event);
			} else {
				return undefined;
			}
		})
		.filter((x): x is EventItem => x !== undefined);

	$: if ($authorChannelsEventStore !== undefined && channelIds.size === 0) {
		console.log('[channels page]', $authorChannelsEventStore);

		const ids = filterTags('e', $authorChannelsEventStore.tags);
		const channelsMetadataReq = createRxOneshotReq({
			filters: [
				{
					kinds: [40],
					ids
				},
				{
					kinds: [41],
					'#e': ids
				}
			]
		});
		const observable = rxNostr.use(channelsMetadataReq).pipe(uniq());
		observable.pipe(filterKind(40)).subscribe((packet) => {
			console.log('[channel definition packet]', packet);
			const channelId = packet.event.id;
			cachedEvents.set(channelId, packet.event);
			channelIds.add(channelId);
			channelIds = channelIds;
		});
		observable
			.pipe(
				filterKind(41),
				latestEach(({ event }) => findChannelId(event.tags))
			)
			.subscribe((packet) => {
				console.log('[channel metadata packet]', packet);
				const channelId = findChannelId(packet.event.tags);
				if (channelId === undefined) {
					return;
				}

				const cache = $channelMetadataEventsStore.get(channelId);
				if (cache === undefined || cache.created_at < packet.event.created_at) {
					$channelMetadataEventsStore.set(channelId, packet.event);
					$channelMetadataEventsStore = $channelMetadataEventsStore;
				}
			});
	}

	async function search() {
		console.log('[channels search]', keyword);

		if (keyword === '') {
			return;
		}

		const q = encodeURIComponent(`${keyword} kind:40 kind:41`);
		await goto(`/search?q=${q}`);
	}
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.channels')}</title>
</svelte:head>

<h1>{$_('layout.header.channels')}</h1>

<form on:submit|preventDefault={search}>
	<input type="search" bind:value={keyword} on:keyup|stopPropagation={() => console.debug} />
	<input type="submit" value={$_('search.search')} />
</form>

<div>
	<ExternalLink link={new URL('https://unyu-house.vercel.app/')}>
		{$_('public_chat.create_channel')}
	</ExternalLink>
</div>

<TimelineView {items} showLoading={false} />

<style>
	form,
	div {
		margin: 1rem auto;
	}
</style>
