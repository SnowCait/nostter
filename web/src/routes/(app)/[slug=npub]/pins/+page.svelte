<script lang="ts">
	import { onDestroy } from 'svelte';
	import { createRxNostr, createRxOneshotReq, latest, uniq } from 'rx-nostr';
	import { firstValueFrom, EmptyError } from 'rxjs';
	import type { Event } from 'nostr-typedef';
	import { _ } from 'svelte-i18n';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import type { LayoutData } from '../$types';
	import { appName } from '$lib/Constants';
	import { WebStorage } from '$lib/WebStorage';
	import { EventItem } from '$lib/Items';
	import { filterTags } from '$lib/EventHelper';
	import { pubkey as authorPubkey, readRelays } from '../../../../stores/Author';
	import TimelineView from '../../TimelineView.svelte';

	export let data: LayoutData;

	let items: EventItem[] = [];

	const rxNostr = createRxNostr();

	afterNavigate(async () => {
		const slug = $page.params.slug;
		console.log('[pin page]', slug);

		rxNostr.setDefaultRelays([...$readRelays, ...data.relays]);

		let event: Event | undefined;
		if (data.pubkey === $authorPubkey) {
			const storage = new WebStorage(localStorage);
			event = storage.getReplaceableEvent(10001);
			console.log('[pin event (author)]', event);
		} else {
			try {
				const pinReq = createRxOneshotReq({
					filters: { kinds: [10001], authors: [data.pubkey], limit: 1 }
				});
				const packet = await firstValueFrom(rxNostr.use(pinReq).pipe(latest()));
				console.log('[pin event]', packet);
				event = packet.event;
			} catch (error) {
				if (!(error instanceof EmptyError)) {
					throw error;
				}
			}
		}

		if (event === undefined) {
			console.log('[pin no event]');
			return;
		}

		const ids = filterTags('e', event.tags);
		if (ids.length === 0) {
			console.log('[pin no tags]');
			return;
		}

		const referenceReq = createRxOneshotReq({ filters: { ids } });
		rxNostr
			.use(referenceReq)
			.pipe(uniq())
			.subscribe((packet) => {
				console.log('[pin e tag]', packet);
				items.push(new EventItem(packet.event));
				items = items;
			});
	});

	onDestroy(() => {
		rxNostr.dispose();
	});
</script>

<svelte:head>
	<title>{appName} - {$_('pages.pinned')}</title>
</svelte:head>

<h1>{$_('pages.pinned')}</h1>

<TimelineView {items} showLoading={false} />
