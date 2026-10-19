<script lang="ts">
	import { accountAddressableEventCache } from '$lib/cache/Events';
	import { createRxOneshotReq, latest, uniq } from 'rx-nostr';
	import { EMPTY, from, map, switchMap, take } from 'rxjs';
	import { _ } from 'svelte-i18n';
	import type { LayoutData } from '../$types';
	import { appName } from '$lib/app';
	import { EventItem } from '$lib/Items';
	import { filterTags } from '$lib/EventHelper';
	import { auth } from '$lib/auth.svelte';
	import { tie } from '$lib/timelines/MainTimeline';
	import { rxNostr } from '$lib/relay-client';
	import TimelineView from '../../TimelineView.svelte';

	interface Props {
		data: LayoutData;
	}

	let { data }: Props = $props();

	let items: EventItem[] = $state([]);

	$effect(() => {
		const pubkey = data.pubkey;
		const on = { defaultReadRelays: true, relays: data.relays };
		const pinEvents =
			pubkey === auth.pubkey
				? from(accountAddressableEventCache.get(pubkey, 10001))
				: rxNostr
						.use(
							createRxOneshotReq({
								filters: { kinds: [10001], authors: [pubkey], limit: 1 }
							}),
							{ on }
						)
						.pipe(
							tie,
							latest(),
							take(1),
							map(({ event }) => event)
						);

		items = [];
		const loadedItems: EventItem[] = [];
		const subscription = pinEvents
			.pipe(
				switchMap((event) => {
					if (event === undefined) {
						return EMPTY;
					}
					const ids = filterTags('e', event.tags);
					if (ids.length === 0) {
						return EMPTY;
					}
					const referenceReq = createRxOneshotReq({ filters: { ids } });
					return rxNostr.use(referenceReq, { on }).pipe(tie, uniq());
				})
			)
			.subscribe((packet) => {
				console.debug('[pin e tag]', packet);
				loadedItems.push(new EventItem(packet.event));
				items = [...loadedItems];
			});

		return () => subscription.unsubscribe();
	});
</script>

<svelte:head>
	<title>{appName} - {$_('pinned-notes.title')}</title>
</svelte:head>

<h1>{$_('pinned-notes.title')}</h1>

<TimelineView {items} showLoading={false} />
