<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { createRxBackwardReq, uniq } from 'rx-nostr';
	import { afterNavigate } from '$app/navigation';
	import { EventItem } from '$lib/Items';
	import { chronologicalItem } from '$lib/Constants';
	import type { pubkey } from '$lib/Types';
	import type { LayoutData } from '../$types';
	import { rxNostr, tie } from '$lib/timelines/MainTimeline';
	import NotFound from '$lib/components/items/NotFound.svelte';
	import TimelineView from '../../TimelineView.svelte';

	interface Props {
		data: LayoutData;
	}

	let { data }: Props = $props();

	let id: string | undefined;
	let itemsMap = $state(new Map<pubkey, EventItem>());

	let items = $derived([...itemsMap].map(([, item]) => item).sort((x, y) => chronologicalItem(x, y)));

	const quotesReq = createRxBackwardReq();
	rxNostr
		.use(quotesReq)
		.pipe(tie, uniq())
		.subscribe((packet) => {
			console.debug('[rx-nostr quotes]', packet, packet.event.pubkey);
			itemsMap.set(packet.event.id, new EventItem(packet.event));
			itemsMap = itemsMap;
		});

	afterNavigate(() => {
		console.log('[quotes page]', data.eventId);
		if (id === data.eventId) {
			return;
		}
		itemsMap.clear();
		itemsMap = itemsMap;
		quotesReq.emit([{ kinds: [1], '#q': [data.eventId] }]);
	});
</script>

<h1>{$_('thread.quotes.title')}</h1>

{#if items.length > 0}
	<TimelineView {items} showLoading={false} />
{:else}
	<NotFound />
{/if}
