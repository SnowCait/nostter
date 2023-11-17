<script lang="ts">
	import { createRxOneshotReq, filterKind, latestEach, now, uniq } from 'rx-nostr';
	import type { Event } from 'nostr-typedef';
	import { cachedEvents, channelMetadataEvents } from '$lib/cache/Events';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { filterTags, findChannelId } from '$lib/EventHelper';
	import { EventItem } from '$lib/Items';
	import { Signer } from '$lib/Signer';
	import { pubkey } from '../../../stores/Author';
	import TimelineView from '../TimelineView.svelte';

	let channelsEvent: Event | undefined;
	let regacyChannelsEvent: Event | undefined; // For migration
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

	console.log('[channels page]');

	const channelsReq = createRxOneshotReq({
		filters: [
			{
				kinds: [10001, 10005],
				authors: [$pubkey]
			}
		]
	});
	rxNostr
		.use(channelsReq)
		.pipe(
			uniq(),
			latestEach((packet) => packet.event.kind)
		)
		.subscribe({
			next: (packet) => {
				console.log('[channels next]', packet);
				if (packet.event.kind === 10005) {
					channelsEvent = packet.event;
				} else if (packet.event.kind === 10001) {
					regacyChannelsEvent = packet.event;
				} else {
					console.error('[invalid event]', packet.event);
				}
			},
			complete: () => {
				console.log('[channels complete]');
				if (channelsEvent === undefined && regacyChannelsEvent !== undefined) {
					migrate(regacyChannelsEvent);
				}
			},
			error: (error) => {
				console.error('[channels error]', error);
			}
		});

	function migrate(regacyChannelsEvent: Event) {
		console.log('[channels migration]', regacyChannelsEvent);

		let channelIds = new Set<string>();
		const channelsMetadataReq = createRxOneshotReq({
			filters: [
				{
					kinds: [40],
					ids: filterTags('e', regacyChannelsEvent.tags)
				}
			]
		});
		rxNostr
			.use(channelsMetadataReq)
			.pipe(uniq())
			.subscribe({
				next: (packet) => {
					console.log('[channel metadata next]', packet);
					channelIds.add(packet.event.id);
				},
				complete: async () => {
					console.log('[channels metadata complete]');
					const event = await Signer.signEvent({
						kind: 10005,
						content: '',
						tags: regacyChannelsEvent.tags.filter(
							([tagName, id]) => tagName === 'e' && channelIds.has(id)
						),
						created_at: now()
					});
					rxNostr.send(event).subscribe((packet) => {
						console.log('[channels migration send]', packet);
						if (packet.ok && channelsEvent === undefined) {
							channelsEvent = event;
						}
					});

					const pinEvent = await Signer.signEvent({
						kind: regacyChannelsEvent.kind,
						content: regacyChannelsEvent.content,
						tags: regacyChannelsEvent.tags.filter(
							([tagName, id]) => !(tagName === 'e' && channelIds.has(id))
						),
						created_at: now()
					});
					rxNostr.send(pinEvent).subscribe((packet) => {
						console.log('[channels migration send pin]', packet);
					});
				}
			});
	}
</script>

<h1>Channels</h1>

<TimelineView {items} load={async () => console.debug()} showLoading={false} />
