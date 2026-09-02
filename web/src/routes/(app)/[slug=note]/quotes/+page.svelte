<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { createRxBackwardReq, uniq } from 'rx-nostr';
	import { EventItem } from '$lib/Items';
	import { chronologicalItem } from '$lib/Constants';
	import type { pubkey } from '$lib/Types';
	import type { LayoutData } from '../$types';
	import { rxNostr, tie } from '$lib/timelines/MainTimeline';
	import NotFound from '$lib/components/items/NotFound.svelte';
	import TimelineView from '../../TimelineView.svelte';
	import { SvelteMap } from 'svelte/reactivity';

	interface Props {
		data: LayoutData;
	}

	let { data }: Props = $props();

	let itemsMap = new SvelteMap<pubkey, EventItem>();

	let items = $derived(
		[...itemsMap].map(([, item]) => item).sort((x, y) => chronologicalItem(x, y))
	);

	const quotesReq = createRxBackwardReq();
	rxNostr
		.use(quotesReq)
		.pipe(tie, uniq())
		.subscribe((packet) => {
			console.debug('[rx-nostr quotes]', packet, packet.event.pubkey);
			itemsMap.set(packet.event.id, new EventItem(packet.event));
		});

	$effect(() => {
		const eventId = data.eventId;
		console.log('[quotes page]', eventId);
		itemsMap.clear();
		quotesReq.emit([{ kinds: [1], '#q': [eventId] }]);
	});
</script>

<h1>{$_('thread.quotes.title')}</h1>

{#if items.length > 0}
	<TimelineView {items} showLoading={false} />
{:else}
	<NotFound />
{/if}
