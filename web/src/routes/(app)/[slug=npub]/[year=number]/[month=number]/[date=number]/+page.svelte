<script lang="ts">
	import { type LazyFilter, createRxBackwardReq, uniq, now } from 'rx-nostr';
	import { filter, tap } from 'rxjs';
	import { nip19 } from 'nostr-tools';
	import { afterNavigate } from '$app/navigation';
	import type { PageData } from './$types';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { metadataStore } from '$lib/cache/Events';
	import { referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import { appName } from '$lib/Constants';
	import { EventItem } from '$lib/Items';
	import { items, pubkey, since } from '$lib/timelines/DateTimeline';
	import DateNavigation from './DateNavigation.svelte';
	import TimelineView from '../../../../TimelineView.svelte';

	export let data: PageData;

	$: metadata = $metadataStore.get(data.pubkey);

	const splitNumber = 4;

	const req = createRxBackwardReq();
	rxNostr
		.use(req)
		.pipe(
			uniq(),
			tap(({ event }) => {
				referencesReqEmit(event);
				authorActionReqEmit(event);
			}),
			filter(({ event }) => !$items.some((x) => x.event.id === event.id))
		)
		.subscribe((packet) => {
			console.debug('[rx-nostr npub date]', packet);
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
				until: $since + hours((i + 1) * (24 / splitNumber))
			};
		}).filter((filter) => filter.since < now());
		console.debug('[npub date page REQ]', filters);
		req.emit(filters);
	});
</script>

<svelte:head>
	{#if metadata === undefined}
		<title>
			{appName} -
			{nip19.npubEncode(data.pubkey)}
			{data.date.toLocaleDateString()}
		</title>
	{:else}
		<title>
			{appName} -
			{metadata.displayName} (@{metadata.name})
			{data.date.toLocaleDateString()}
		</title>
	{/if}
</svelte:head>

<DateNavigation slug={data.slug} date={data.date} />
<TimelineView items={$items} showLoading={false} />
{#if $items.length > 0}
	<DateNavigation slug={data.slug} date={data.date} />
{/if}
