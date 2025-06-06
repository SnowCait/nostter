<script lang="ts">
	import { Tabs } from '@svelteuidev/core';
	import type { Filter } from 'nostr-typedef';
	import { createRxOneshotReq, now, uniq } from 'rx-nostr';
	import { tap } from 'rxjs';
	import { _ } from 'svelte-i18n';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { referencesReqEmit, rxNostr, storeSeenOn, tie } from '$lib/timelines/MainTimeline';
	import { appName, minTimelineLength, notificationsFilterKinds } from '$lib/Constants';
	import { EventItem } from '$lib/Items';
	import { lastReadAt, notifiedEventItems } from '$lib/author/Notifications';
	import { pubkey, author } from '$lib/stores/Author';
	import TimelineView from '../TimelineView.svelte';
	import IconAt from '@tabler/icons-svelte/icons/at';
	import IconRepeat from '@tabler/icons-svelte/icons/repeat';
	import IconHeart from '@tabler/icons-svelte/icons/heart';
	import IconBolt from '@tabler/icons-svelte/icons/bolt';
	import { preferencesStore } from '$lib/Preferences';
	import { followeesOfFollowees } from '$lib/author/MuteAutomatically';
	import { Signer } from '$lib/Signer';

	$: items = $notifiedEventItems.filter(
		(item) =>
			!$preferencesStore.muteAutomatically || $followeesOfFollowees.has(item.event.pubkey)
	);

	afterNavigate(async () => {
		console.debug('[notifications page]');

		if ($author === undefined) {
			await goto('/');
		}
	});

	beforeNavigate(async () => {
		console.debug('[notifications page leave]');

		const event = await Signer.signEvent({
			kind: 30078,
			content: '',
			tags: [['d', 'nostter-read']],
			created_at: now()
		});
		rxNostr.send(event);
		lastReadAt.set(event.created_at);
	});

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
					kinds: notificationsFilterKinds,
					'#p': [$pubkey],
					until,
					since
				}
			];

			console.debug(
				'[rx-nostr notification timeline REQ]',
				filters,
				rxNostr.getAllRelayStatus()
			);
			const pastEventsReq = createRxOneshotReq({ filters });
			await new Promise<void>((resolve, reject) => {
				rxNostr
					.use(pastEventsReq)
					.pipe(
						tie,
						uniq(),
						tap(({ event, from }) => {
							referencesReqEmit(event);
							authorActionReqEmit(event);
							storeSeenOn(event.id, from);
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

<Tabs grow>
	<Tabs.Tab>
		<svelte:fragment slot="label">
			<div>{$_('notifications.all')}</div>
		</svelte:fragment>
		<TimelineView {items} {load} />
	</Tabs.Tab>
	<Tabs.Tab>
		<svelte:fragment slot="icon">
			<IconAt color="var(--orange)" size={20} />
		</svelte:fragment>
		<TimelineView items={items.filter((item) => item.event.kind === 1)} showLoading={false} />
	</Tabs.Tab>
	<Tabs.Tab>
		<svelte:fragment slot="icon">
			<IconRepeat color="var(--green)" size={20} />
		</svelte:fragment>
		<TimelineView
			items={items.filter((item) => [6, 16].includes(item.event.kind))}
			showLoading={false}
		/>
	</Tabs.Tab>
	<Tabs.Tab>
		<svelte:fragment slot="icon">
			<IconHeart color="var(--pink)" size={20} />
		</svelte:fragment>
		<TimelineView items={items.filter((item) => item.event.kind === 7)} showLoading={false} />
	</Tabs.Tab>
	<Tabs.Tab>
		<svelte:fragment slot="icon">
			<IconBolt color="var(--yellow)" size={20} />
		</svelte:fragment>
		<TimelineView
			items={items.filter((item) => item.event.kind === 9735)}
			showLoading={false}
		/>
	</Tabs.Tab>
	<Tabs.Tab>
		<svelte:fragment slot="label">
			<div>{$_('notifications.others')}</div>
		</svelte:fragment>
		<TimelineView
			items={items.filter((item) => ![1, 6, 16, 7, 9735].includes(item.event.kind))}
			showLoading={false}
		/>
	</Tabs.Tab>
</Tabs>

<style>
	h1 {
		display: flex;
		justify-content: space-between;
	}

	div {
		color: var(--accent);
	}

	:global(button.svelteui-Tab) {
		border-radius: 0;
	}
</style>
