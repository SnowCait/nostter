<script lang="ts">
	import type { Kind } from 'nostr-tools';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { NotificationTimeline } from '$lib/NotificationTimeline';
	import { minTimelineLength } from '$lib/Constants';
	import { Api } from '$lib/Api';
	import { notifiedEvents, unreadEvents } from '../../../stores/Notifications';
	import { pubkey, writeRelays } from '../../../stores/Author';
	import { pool } from '../../../stores/Pool';
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
			await api.signAndPublish(30078 as Kind, '', [['d', 'nostter-read']]);
		} catch (error) {
			console.warn('[last read failed]', error);
		}
	});

	async function load() {
		const timeline = new NotificationTimeline($pubkey);

		let firstLength = $notifiedEvents.length;
		let count = 0;
		let until =
			$notifiedEvents.at($notifiedEvents.length - 1)?.event.created_at ??
			Math.floor(Date.now() / 1000);
		let seconds = 12 * 60 * 60;

		while ($notifiedEvents.length - firstLength < minTimelineLength && count < 10) {
			const pastEventItems = await timeline.fetch(until, until - seconds);
			$notifiedEvents.push(...pastEventItems);
			$notifiedEvents = $notifiedEvents;

			until -= seconds;
			seconds *= 2;
			count++;
			console.log('[load]', count, until, seconds / 3600, $notifiedEvents.length);
		}
	}
</script>

<h1>Notifications</h1>

<TimelineView items={$notifiedEvents} {load} />
