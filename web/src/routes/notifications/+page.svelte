<script lang="ts">
	import type { Kind } from 'nostr-tools';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { NotificationTimeline } from '$lib/NotificationTimeline';
	import { minTimelineLength } from '$lib/Constants';
	import { Api } from '$lib/Api';
	import { notifiedEvents, unreadEvents, loadingNotifications } from '../../stores/Notifications';
	import { pubkey, writeRelays } from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';

	afterNavigate(() => {
		console.log('[notifications page]');
		$unreadEvents = [];
	});

	beforeNavigate(async () => {
		console.log('[notifications page leave]');
		$unreadEvents = [];

		const api = new Api($pool, $writeRelays);
		try {
			await api.signAndPublish(30000 as Kind, Math.floor(Date.now() / 1000).toString(), [
				['d', 'notifications/lastOpened']
			]);
		} catch (error) {
			console.warn('[last read failed]', error);
		}
	});

	async function load() {
		if ($loadingNotifications) {
			return;
		}

		const timeline = new NotificationTimeline($pubkey);

		let firstLength = $notifiedEvents.length;
		let count = 0;
		let until =
			$notifiedEvents.at($notifiedEvents.length - 1)?.created_at ??
			Math.floor(Date.now() / 1000);
		let seconds = 12 * 60 * 60;

		while ($notifiedEvents.length - firstLength < minTimelineLength && count < 10) {
			const pastEventItems = await timeline.fetch(until, until - seconds);
			$notifiedEvents.push(...(await Promise.all(pastEventItems.map((x) => x.toEvent()))));
			$notifiedEvents = $notifiedEvents;

			until -= seconds;
			seconds *= 2;
			count++;
			console.log('[load]', count, until, seconds / 3600, $notifiedEvents.length);
		}
	}
</script>

<h1>Notifications</h1>

<TimelineView events={$notifiedEvents} {load} />
