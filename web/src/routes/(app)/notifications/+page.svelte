<script lang="ts">
	import type { Kind } from 'nostr-tools';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { NotificationTimeline } from '$lib/NotificationTimeline';
	import { minTimelineLength } from '$lib/Constants';
	import { Api } from '$lib/Api';
	import type { LayoutData } from '../$types';
	import { notifiedEventItems, unreadEventItems } from '../../../stores/Notifications';
	import { pubkey, writeRelays } from '../../../stores/Author';
	import { pool } from '../../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';

	export let data: LayoutData;

	afterNavigate(async () => {
		console.log('[notifications page]');

		if (!data.authenticated) {
			await goto('/');
		}

		$unreadEventItems = [];
	});

	beforeNavigate(async () => {
		console.log('[notifications page leave]');
		$unreadEventItems = [];

		const api = new Api($pool, $writeRelays);
		try {
			await api.signAndPublish(30078 as Kind, '', [['d', 'nostter-read']]);
		} catch (error) {
			console.warn('[last read failed]', error);
		}
	});

	async function load() {
		const timeline = new NotificationTimeline($pubkey);

		let firstLength = $notifiedEventItems.length;
		let count = 0;
		let until =
			$notifiedEventItems.at($notifiedEventItems.length - 1)?.event.created_at ??
			Math.floor(Date.now() / 1000);
		let seconds = 12 * 60 * 60;

		while ($notifiedEventItems.length - firstLength < minTimelineLength && count < 10) {
			const pastEventItems = await timeline.fetch(until, until - seconds);
			$notifiedEventItems.push(...pastEventItems);
			$notifiedEventItems = $notifiedEventItems;

			until -= seconds;
			seconds *= 2;
			count++;
			console.log('[load]', count, until, seconds / 3600, $notifiedEventItems.length);
		}
	}
</script>

<h1>Notifications</h1>

<TimelineView items={$notifiedEventItems} {load} />
