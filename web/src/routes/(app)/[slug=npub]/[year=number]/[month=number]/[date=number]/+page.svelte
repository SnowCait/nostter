<script lang="ts">
	import { type LazyFilter, createRxBackwardReq, uniq } from 'rx-nostr';
	import { afterNavigate } from '$app/navigation';
	import type { PageData } from './$types';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { EventItem } from '$lib/Items';
	import { items, pubkey, since } from '$lib/timelines/DateTimeline';
	import TimelineView from '../../../../TimelineView.svelte';

	export let data: PageData;

	const splitNumber = 4;

	const req = createRxBackwardReq();
	rxNostr
		.use(req)
		.pipe(uniq())
		.subscribe((packet) => {
			console.debug('[rx-nostr event]', packet);
			const item = new EventItem(packet.event);
			const index = $items.findIndex((x) => x.event.created_at < item.event.created_at);
			if (index < 0) {
				$items.push(item);
			} else {
				$items.splice(index, 0, item);
			}
			$items = $items;
		});

	afterNavigate(() => {
		console.log(
			'[npub date page]',
			data.date.toLocaleString(),
			data.pubkey,
			new Date($since * 1000).toLocaleString(),
			$pubkey
		);
		const time = Math.floor(data.date.getTime() / 1000);
		if ($pubkey === data.pubkey && $since === time) {
			return;
		}
		$pubkey = data.pubkey;
		$since = time;
		$items = [];
		const filters: LazyFilter[] = Array.from({ length: splitNumber }, (_, i) => {
			const hours = (i: number): number => i * 60 * 60;
			return {
				kinds: [1],
				authors: [data.pubkey],
				since: $since + hours(i * (24 / splitNumber)),
				until: $since + hours(i * (24 / splitNumber) + splitNumber)
			};
		});
		req.emit(filters);
	});
</script>

<h1>{data.date.toLocaleDateString()}</h1>

<TimelineView items={$items} load={async () => console.debug()} showLoading={false} />
