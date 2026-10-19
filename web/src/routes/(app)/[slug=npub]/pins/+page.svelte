<script lang="ts">
	import { accountAddressableEventCache } from '$lib/cache/Events';
	import { onDestroy } from 'svelte';
	import { createRxOneshotReq, latest, uniq } from 'rx-nostr';
	import { firstValueFrom, EmptyError, Subject, takeUntil } from 'rxjs';
	import type * as Nostr from 'nostr-typedef';
	import { _ } from 'svelte-i18n';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
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

	let cancelLoad = () => {};

	afterNavigate(async () => {
		cancelLoad();
		const cancelled = new Subject<void>();
		let active = true;
		cancelLoad = () => {
			active = false;
			cancelled.next();
			cancelled.complete();
		};
		items = [];

		const slug = page.params.slug;
		console.debug('[pin page]', slug);

		const on = { defaultReadRelays: true, relays: data.relays };

		let event: Nostr.Event | undefined;
		if (data.pubkey === auth.pubkey) {
			event = await accountAddressableEventCache.get(data.pubkey, 10001);
			console.debug('[pin event (author)]', event);
		} else {
			try {
				const pinReq = createRxOneshotReq({
					filters: { kinds: [10001], authors: [data.pubkey], limit: 1 }
				});
				const packet = await firstValueFrom(
					rxNostr.use(pinReq, { on }).pipe(tie, latest(), takeUntil(cancelled))
				);
				console.debug('[pin event]', packet);
				event = packet.event;
			} catch (error) {
				if (!(error instanceof EmptyError)) {
					throw error;
				}
			}
		}

		if (!active) {
			return;
		}

		if (event === undefined) {
			console.debug('[pin no event]');
			return;
		}

		const ids = filterTags('e', event.tags);
		if (ids.length === 0) {
			console.debug('[pin no tags]');
			return;
		}

		const referenceReq = createRxOneshotReq({ filters: { ids } });
		rxNostr
			.use(referenceReq, { on })
			.pipe(tie, uniq(), takeUntil(cancelled))
			.subscribe((packet) => {
				console.debug('[pin e tag]', packet);
				items.push(new EventItem(packet.event));
				items = items;
			});
	});

	onDestroy(() => {
		cancelLoad();
	});
</script>

<svelte:head>
	<title>{appName} - {$_('pinned-notes.title')}</title>
</svelte:head>

<h1>{$_('pinned-notes.title')}</h1>

<TimelineView {items} showLoading={false} />
