<script lang="ts">
	import { createRxOneshotReq, filterKind, uniq } from 'rx-nostr';
	import type { Event } from 'nostr-typedef';
	import { afterNavigate } from '$app/navigation';
	import { WebStorage } from '$lib/WebStorage';
	import { cachedEvents, channelMetadataEvents } from '$lib/cache/Events';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { filterTags, findChannelId } from '$lib/EventHelper';
	import { EventItem } from '$lib/Items';
	import TimelineView from '../TimelineView.svelte';

	let channelsEvent: Event | undefined;
	let channelIds: string[] = [];

	$: items = channelIds.map((channelId) => {
		let event = channelMetadataEvents.get(channelId);
		if (event !== undefined) {
			return new EventItem(event);
		}
		event = cachedEvents.get(channelId);
		if (event !== undefined) {
			return new EventItem(event);
		}

		throw new Error(`Logic error: ${channelId}`);
	});

	$: if (channelsEvent !== undefined && channelIds.length === 0) {
		console.log('[channels fetch]', channelsEvent);

		const ids = filterTags('e', channelsEvent.tags);
		const channelsMetadataReq = createRxOneshotReq({
			filters: [
				{
					kinds: [40],
					ids
				},
				{
					kinds: [41],
					ids
				}
			]
		});
		const observable = rxNostr.use(channelsMetadataReq).pipe(uniq());
		observable.pipe(filterKind(40)).subscribe((packet) => {
			console.log('[channel metadata original]', packet);
			const channelId = packet.event.id;
			cachedEvents.set(channelId, packet.event);
			channelIds.push(channelId);
			channelIds = channelIds;
		});
		observable.pipe(filterKind(41)).subscribe((packet) => {
			console.log('[channel metadata]', packet);
			const channelId = findChannelId(packet.event.tags);
			if (channelId !== undefined) {
				channelMetadataEvents.set(channelId, packet.event);
			}
		});
	}

	afterNavigate(() => {
		console.log('[channels page]');

		const storage = new WebStorage(localStorage);
		channelsEvent = storage.getReplaceableEvent(10005);
	});
</script>

<h1>Channels</h1>

<TimelineView {items} load={async () => console.debug()} showLoading={false} />
