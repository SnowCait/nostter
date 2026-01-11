<script lang="ts">
	import { run } from 'svelte/legacy';

	import { _ } from 'svelte-i18n';
	import { createRxOneshotReq, now, uniq, type LazyFilter } from 'rx-nostr';
	import { filter, tap } from 'rxjs';
	import TimelineView from '../../TimelineView.svelte';
	import { referencesReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import { items } from '$lib/timelines/ReactionsTimeline';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { EventItem } from '$lib/Items';
	import { appName, minTimelineLength } from '$lib/Constants';
	import type { LayoutData } from '../$types';

	interface Props {
		data: LayoutData;
	}

	let { data }: Props = $props();

	let pubkey: string | undefined = $state();
	let showLoading = $state(false);

	run(() => {
		if (pubkey !== data.pubkey) {
			$items = [];
		}
	});

	async function load() {
		console.log('[npub reactions page load]', data.pubkey);

		pubkey = data.pubkey;
		showLoading = true;

		let firstLength = $items.length;
		let count = 0;
		let until =
			$items.length > 0 ? Math.min(...$items.map((item) => item.event.created_at)) : now();
		let seconds = 12 * 60 * 60;

		while ($items.length - firstLength < minTimelineLength && count < 10) {
			const since = until - seconds;
			console.log(
				'[rx-nostr reactions timeline period]',
				new Date(since * 1000),
				new Date(until * 1000)
			);

			const filters: LazyFilter[] = [
				{
					kinds: [7],
					authors: [pubkey],
					until,
					since
				}
			];
			console.log('[rx-nostr reactions timeline REQ]', filters);

			const pastEventsReq = createRxOneshotReq({ filters });
			await new Promise<void>((resolve, reject) => {
				rxNostr
					.use(pastEventsReq)
					.pipe(
						tie,
						uniq(),
						filter(
							({ event }) => since <= event.created_at && event.created_at < until
						),
						tap(({ event }) => {
							referencesReqEmit(event);
							authorActionReqEmit(event);
						})
					)
					.subscribe({
						next: (packet) => {
							console.log('[rx-nostr reactions timeline packet]', packet);
							if ($items.some((x) => x.event.id === packet.event.id)) {
								console.warn(
									'[rx-nostr reactions timeline duplicate]',
									packet.event
								);
								return;
							}
							const item = new EventItem(packet.event);
							const index = $items.findIndex(
								(x) => x.event.created_at < item.event.created_at
							);
							if (index < 0) {
								$items.push(item);
							} else {
								$items.splice(index, 0, item);
							}
							$items = $items;
						},
						complete: () => {
							console.log(
								'[rx-nostr reactions timeline complete]',
								pastEventsReq.rxReqId
							);
							resolve();
						},
						error: (error) => {
							reject(error);
						}
					});
			});

			until -= seconds;
			seconds *= 2;
			count++;
			console.log(
				'[rx-nostr reactions timeline loaded]',
				pastEventsReq.rxReqId,
				count,
				until,
				seconds / 3600,
				$items.length
			);
		}

		showLoading = false;
	}
</script>

<svelte:head>
	<title>{appName} - {$_('pages.reactions')}</title>
</svelte:head>

<h1>{$_('pages.reactions')}</h1>

<TimelineView items={$items} {load} {showLoading} />
