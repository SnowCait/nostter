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
	import { findIdentifier } from '$lib/EventHelper';
	import { fetchListEvent, getListPubkeys, getListTitle } from '$lib/List';
	import type { PageProps } from './$types';
	import TimelineView from '../../../../TimelineView.svelte';
	import ProfileTabs from '../../ProfileTabs.svelte';
	import { page } from '$app/state';

	let { data }: PageProps = $props();

	let slug = $derived(page.params.slug!);

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

		if ($event === undefined) {
			return;
		}

		$pubkeys = await getListPubkeys($event);
		subscribeListTimeline();
		loadListTimeline();
	});

	beforeNavigate(() => {
		$ready = false;
	});

	let title = $derived($event === undefined ? '' : getListTitle($event.tags));
</script>

<svelte:head>
	<title>{appName} - {title}</title>
</svelte:head>

<ProfileTabs tab="lists" {slug} />

<h1>
	<span>{title}</span>
	{#if $event !== undefined}
		<span>({$pubkeys.length})</span>
	{/if}
</h1>

<TimelineView items={$items} load={loadListTimeline} />
