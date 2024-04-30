<script lang="ts">
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import {
		clear,
		event,
		items,
		loadListTimeline,
		pubkeys,
		ready,
		subscribeListTimeline
	} from '$lib/timelines/ListTimeline';
	import { appName } from '$lib/Constants';
	import { filterTags, findIdentifier } from '$lib/EventHelper';
	import type { PageData } from './$types';
	import TimelineView from '../../../TimelineView.svelte';
	import { fetchListEvent, getListTitle } from '$lib/List';

	export let data: PageData;

	afterNavigate(async () => {
		console.log('[list page]', data.naddr, data);

		if (
			$event !== undefined &&
			$event.kind === data.kind &&
			$event.pubkey === data.pubkey &&
			(findIdentifier($event.tags) ?? '') === data.identifier
		) {
			return;
		}

		clear();
		$ready = true;

		$event = await fetchListEvent(data.kind, data.pubkey, data.identifier);
	});

	beforeNavigate(() => {
		$ready = false;
	});

	$: if ($event !== undefined) {
		console.debug('[list event]', event);
		$pubkeys = filterTags('p', $event.tags);
		subscribeListTimeline();
		loadListTimeline();
	}

	$: title = $event === undefined ? '' : getListTitle($event.tags);
</script>

<svelte:head>
	<title>{appName} - {title}</title>
</svelte:head>

<h1>
	<span>{title}</span>
	{#if $event !== undefined}
		<span>({$pubkeys.length})</span>
	{/if}
</h1>

<TimelineView items={$items} load={loadListTimeline} />
