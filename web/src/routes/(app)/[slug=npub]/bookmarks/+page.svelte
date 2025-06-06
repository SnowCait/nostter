<script lang="ts">
	import { createRxOneshotReq, uniq } from 'rx-nostr';
	import { tap } from 'rxjs';
	import { _ } from 'svelte-i18n';
	import { pubkey as authorPubkey, rom } from '$lib/stores/Author';
	import { page } from '$app/stores';
	import TimelineView from '../../TimelineView.svelte';
	import { bookmarkEvent } from '$lib/author/Bookmark';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { appName, reverseChronologicalItem } from '$lib/Constants';
	import { filterTags } from '$lib/EventHelper';
	import { Signer } from '$lib/Signer';
	import { EventItem } from '$lib/Items';
	import { referencesReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import type { LayoutData } from '../$types';

	export let data: LayoutData;

	let publicBookmarkEventItems: EventItem[] = [];
	let privateBookmarkEventItems: EventItem[] = [];

	console.log('[bookmark page]', $page.params.slug);

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
					console.log('[rx-nostr public bookmark packet]', packet);
					publicBookmarkEventItems.push(new EventItem(packet.event));
					publicBookmarkEventItems =
						publicBookmarkEventItems.sort(reverseChronologicalItem);
				});
		}

		if (data.pubkey === $authorPubkey && !$rom && $bookmarkEvent.content !== '') {
			Signer.decrypt($authorPubkey, $bookmarkEvent.content)
				.then((json) => JSON.parse(json) as string[][])
				.then((tags) => {
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
								console.log('[rx-nostr private bookmark packet]', packet);
								privateBookmarkEventItems.push(new EventItem(packet.event));
								privateBookmarkEventItems = privateBookmarkEventItems.toSorted(
									(a, b) => b.event.created_at - a.event.created_at
								);
							});
					}
				})
				.catch((reason) => {
					console.warn('[nip04.decrypt]', reason, $bookmarkEvent);
				});
		}
	}
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.bookmarks')}</title>
</svelte:head>

<h1>{$_('layout.header.bookmarks')}</h1>

<h2>Public</h2>

<TimelineView items={publicBookmarkEventItems} showLoading={false} />

{#if privateBookmarkEventItems.length > 0}
	<h2>Private</h2>

	<TimelineView items={privateBookmarkEventItems} showLoading={false} />
{/if}
