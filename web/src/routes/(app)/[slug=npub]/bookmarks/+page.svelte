<script lang="ts">
	import { createRxOneshotReq, uniq } from 'rx-nostr';
	import { tap } from 'rxjs';
	import { _ } from 'svelte-i18n';
	import { pubkey as authorPubkey, rom } from '$lib/stores/Author';
	import TimelineView from '../../TimelineView.svelte';
	import { bookmarkEvent, legacyBookmarkEvent } from '$lib/author/Bookmark';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { appName, reverseChronologicalItem } from '$lib/Constants';
	import { filterTags } from '$lib/EventHelper';
	import { EventItem } from '$lib/Items';
	import { referencesReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import type { LayoutProps } from '../$types';
	import { decryptListContent } from '$lib/List';

	let { data }: LayoutProps = $props();

	let publicBookmarkEventItems: EventItem[] = $state([]);
	let privateBookmarkEventItems: EventItem[] = $state([]);
	let publicLegacyBookmarkEventItems: EventItem[] = $state([]);
	let privateLegacyBookmarkEventItems: EventItem[] = $state([]);

	// Public bookmarks
	if ($bookmarkEvent !== undefined) {
		const ids = filterTags('e', $bookmarkEvent.tags);
		if (ids.length > 0) {
			const eventsReq = createRxOneshotReq({
				filters: [
					{
						ids
					}
				]
			});
			rxNostr
				.use(eventsReq)
				.pipe(
					tie,
					uniq(),
					tap(({ event }) => {
						referencesReqEmit(event);
						authorActionReqEmit(event);
					})
				)
				.subscribe((packet) => {
					console.debug('[bookmark public]', packet);
					publicBookmarkEventItems.push(new EventItem(packet.event));
					publicBookmarkEventItems =
						publicBookmarkEventItems.sort(reverseChronologicalItem);
				});
		}
	}

	// Public legacy bookmarks
	if ($legacyBookmarkEvent !== undefined) {
		const ids = filterTags('e', $legacyBookmarkEvent.tags);
		if (ids.length > 0) {
			const eventsReq = createRxOneshotReq({ filters: [{ ids }] });
			rxNostr
				.use(eventsReq)
				.pipe(
					tie,
					uniq(),
					tap(({ event }) => {
						referencesReqEmit(event);
						authorActionReqEmit(event);
					})
				)
				.subscribe((packet) => {
					console.debug('[legacy bookmark public]', packet);
					publicLegacyBookmarkEventItems.push(new EventItem(packet.event));
					publicLegacyBookmarkEventItems =
						publicLegacyBookmarkEventItems.sort(reverseChronologicalItem);
				});
		}
	}

	// Private bookmarks
	$effect(() => {
		if (
			data.pubkey === $authorPubkey &&
			!$rom &&
			$bookmarkEvent !== undefined &&
			$bookmarkEvent.content !== ''
		) {
			decryptListContent($authorPubkey, $bookmarkEvent.content).then(([tags]) => {
				const ids = filterTags('e', tags);
				if (ids.length > 0) {
					const eventsReq = createRxOneshotReq({
						filters: [
							{
								ids
							}
						]
					});
					rxNostr
						.use(eventsReq)
						.pipe(
							tie,
							uniq(),
							tap(({ event }) => {
								referencesReqEmit(event);
								authorActionReqEmit(event);
							})
						)
						.subscribe((packet) => {
							console.debug('[bookmark private]', packet);
							privateBookmarkEventItems.push(new EventItem(packet.event));
							privateBookmarkEventItems = privateBookmarkEventItems.toSorted(
								(a, b) => b.event.created_at - a.event.created_at
							);
						});
				}
			});
		}
	});

	// Private legacy bookmarks
	$effect(() => {
		if (
			data.pubkey === $authorPubkey &&
			!$rom &&
			$legacyBookmarkEvent !== undefined &&
			$legacyBookmarkEvent.content !== ''
		) {
			decryptListContent($authorPubkey, $legacyBookmarkEvent.content).then(([tags]) => {
				const ids = filterTags('e', tags);
				if (ids.length > 0) {
					const eventsReq = createRxOneshotReq({ filters: [{ ids }] });
					rxNostr
						.use(eventsReq)
						.pipe(
							tie,
							uniq(),
							tap(({ event }) => {
								referencesReqEmit(event);
								authorActionReqEmit(event);
							})
						)
						.subscribe((packet) => {
							console.debug('[legacy bookmark private]', packet);
							privateLegacyBookmarkEventItems.push(new EventItem(packet.event));
							privateLegacyBookmarkEventItems =
								privateLegacyBookmarkEventItems.sort(reverseChronologicalItem);
						});
				}
			});
		}
	});
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.bookmarks')}</title>
</svelte:head>

<h1>{$_('layout.header.bookmarks')}</h1>

{#if $bookmarkEvent !== undefined}
	<h2>Bookmarks</h2>

	<h3>Public</h3>

	<TimelineView items={publicBookmarkEventItems} showLoading={false} />

	{#if privateBookmarkEventItems.length > 0}
		<h3>Private</h3>

		<TimelineView items={privateBookmarkEventItems} showLoading={false} />
	{/if}
{/if}

{#if $legacyBookmarkEvent !== undefined}
	<h2>Legacy bookmarks</h2>

	<h3>Public</h3>

	<TimelineView items={publicLegacyBookmarkEventItems} showLoading={false} />

	{#if privateLegacyBookmarkEventItems.length > 0}
		<h3>Private</h3>

		<TimelineView items={privateLegacyBookmarkEventItems} showLoading={false} />
	{/if}
{/if}
