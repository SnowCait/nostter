<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { createRxBackwardReq, createRxForwardReq, uniq } from 'rx-nostr';
	import { tap } from 'rxjs';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { EventItem } from '$lib/Items';
	import { authorActionReqEmit } from '$lib/author/Action';
	import type { pubkey } from '$lib/Types';
	import type { LayoutData } from '../../$types';
	import { referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import NotFound from '$lib/components/items/NotFound.svelte';
	import EventComponent from '../../../timeline/EventComponent.svelte';
	import TimelineView from '../../../TimelineView.svelte';

	export let data: LayoutData;

	let item: EventItem | undefined;
	let itemsMap = new Map<pubkey, EventItem>();

	$: items = [...itemsMap].map(([, item]) => item);

	const eventReq = createRxBackwardReq();
	rxNostr
		.use(eventReq)
		.pipe(
			uniq(),
			tap(({ event }) => {
				referencesReqEmit(event);
				authorActionReqEmit(event);
			})
		)
		.subscribe((packet) => {
			console.debug('[rx-nostr thread]', packet, new Date(packet.event.created_at * 1000));
			item = new EventItem(packet.event);
			repostsReq.emit([{ kinds: [6], '#e': [data.eventId] }]);
		});

	const repostsReq = createRxForwardReq();
	rxNostr
		.use(repostsReq)
		.pipe(uniq())
		.subscribe((packet) => {
			console.debug('[rx-nostr reposts]', packet, packet.event.pubkey);
			if (item === undefined) {
				console.error('[after reposts logic error]');
				return;
			}
			const createdAt = item.event.created_at;
			eventsReq.emit([
				{
					kinds: [1],
					authors: [packet.event.pubkey],
					since: createdAt,
					until: createdAt + 10 * 60
				}
			]);
		});

	const eventsReq = createRxForwardReq();
	rxNostr
		.use(eventsReq)
		.pipe(
			uniq(),
			tap(({ event }) => {
				referencesReqEmit(event);
				authorActionReqEmit(event);
			})
		)
		.subscribe((packet) => {
			console.debug('[rx-nostr after reposts]', packet);
			const { event } = packet;
			const item = itemsMap.get(event.pubkey);
			if (item === undefined) {
				itemsMap.set(event.pubkey, new EventItem(event));
				itemsMap = itemsMap;
			} else if (item.event.created_at > event.created_at) {
				itemsMap.set(event.pubkey, new EventItem(event));
				itemsMap = itemsMap;
			}
		});

	afterNavigate(() => {
		console.log('[after reposts page]', data);
		eventReq.emit([{ ids: [data.eventId] }]);
	});

	beforeNavigate(() => {});
</script>

<h1>{$_('thread.reposts.after.title')}</h1>

<article class="card">
	{#if item === undefined}
		<NotFound />
	{:else}
		<EventComponent {item} readonly={false} full={true} />
	{/if}
</article>

{#if items.length > 0}
	<TimelineView {items} load={async () => console.debug()} showLoading={false} />
{:else}
	<NotFound />
{/if}

<style>
	article {
		padding: 0;
		margin-bottom: 1rem;
	}
</style>
