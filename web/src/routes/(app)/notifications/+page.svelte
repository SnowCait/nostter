<script lang="ts">
	import type { Kind } from 'nostr-tools';
	import type { Filter } from 'nostr-typedef';
	import { createRxOneshotReq, uniq } from 'rx-nostr';
	import { tap } from 'rxjs';
	import { _ } from 'svelte-i18n';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import { notificationKinds } from '$lib/NotificationTimeline';
	import { appName, minTimelineLength } from '$lib/Constants';
	import { EventItem } from '$lib/Items';
	import { Api } from '$lib/Api';
	import { notifiedEventItems, unreadEventItems } from '../../../stores/Notifications';
	import { pubkey, author, writeRelays } from '../../../stores/Author';
	import { pool } from '../../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';

	afterNavigate(async () => {
		console.log('[notifications page]');

		if ($author === undefined) {
			await goto('/');
		}

		clear();
	});

	beforeNavigate(async () => {
		console.log('[notifications page leave]');
		clear();

		const api = new Api($pool, $writeRelays);
		try {
			await api.signAndPublish(30078 as Kind, '', [['d', 'nostter-read']]);
		} catch (error) {
			console.warn('[last read failed]', error);
		}
	});

	function clear(): void {
		$unreadEventItems = [];
	}

	async function load() {
		console.log('[rx-nostr notification timeline load]');

		let firstLength = $notifiedEventItems.length;
		let count = 0;
		let until =
			$notifiedEventItems.length > 0
				? $notifiedEventItems[$notifiedEventItems.length - 1].event.created_at
				: Math.floor(Date.now() / 1000);
		let seconds = 6 * 60 * 60;

		while ($notifiedEventItems.length - firstLength < minTimelineLength && count < 10) {
			const since = until - seconds;
			console.log(
				'[rx-nostr notification timeline period]',
				new Date(since * 1000),
				new Date(until * 1000)
			);

			const filters: Filter[] = [
				{
					kinds: notificationKinds,
					'#p': [$pubkey],
					until,
					since
				}
			];

			console.debug(
				'[rx-nostr notification timeline REQ]',
				filters,
				rxNostr.getAllRelayState()
			);
			const pastEventsReq = createRxOneshotReq({ filters });
			await new Promise<void>((resolve, reject) => {
				rxNostr
					.use(pastEventsReq)
					.pipe(
						uniq(),
						tap(({ event }) => {
							referencesReqEmit(event);
							authorActionReqEmit(event);
						})
					)
					.subscribe({
						next: async (packet) => {
							console.debug('[rx-nostr notification timeline packet]', packet);
							if (
								!(
									since <= packet.event.created_at &&
									packet.event.created_at < until
								)
							) {
								console.warn(
									'[rx-nostr notification timeline out of period]',
									packet,
									since,
									until
								);
								return;
							}
							if (!$author?.isNotified(packet.event)) {
								return;
							}
							if ($notifiedEventItems.some((x) => x.event.id === packet.event.id)) {
								console.warn(
									'[rx-nostr notification timeline duplicate]',
									packet.event
								);
								return;
							}
							const item = new EventItem(packet.event);
							const index = $notifiedEventItems.findIndex(
								(x) => x.event.created_at < item.event.created_at
							);
							if (index < 0) {
								$notifiedEventItems.push(item);
							} else {
								$notifiedEventItems.splice(index, 0, item);
							}
							$notifiedEventItems = $notifiedEventItems;
						},
						complete: () => {
							console.log('[rx-nostr notification timeline complete]');
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
				'[rx-nostr notification timeline loaded]',
				count,
				until,
				seconds / 3600,
				$notifiedEventItems.length
			);
		}
	}
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.notifications')}</title>
</svelte:head>

<h1>{$_('layout.header.notifications')}</h1>

<TimelineView items={$notifiedEventItems} {load} />
