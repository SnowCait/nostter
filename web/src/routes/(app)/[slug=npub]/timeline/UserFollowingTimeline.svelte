<script lang="ts">
	import { createRxOneshotReq, now, uniq } from 'rx-nostr';
	import { tap, bufferTime } from 'rxjs';
	import { Timeline } from '$lib/Timeline';
	import { Api } from '$lib/Api';
	import TimelineView from '../../TimelineView.svelte';
	import {
		pubkey as authorPubkey,
		followees as authorFollowees,
		readRelays
	} from '../../../../stores/Author';
	import { userTimelineEvents as items } from '../../../../stores/Events';
	import { Kind, SimplePool, type Event, nip19 } from 'nostr-tools';
	import { minTimelineLength, reverseChronologicalItem, timelineBufferMs } from '$lib/Constants';
	import { rxNostr, referencesReqEmit } from '$lib/timelines/MainTimeline';
	import { EventItem } from '$lib/Items';

	export let pubkey: string;

	let followees: string[] = [];
	let timeline: Timeline;
	let unsubscribe: () => void;

	export async function initialize() {
		console.log('[user following timeline initialize]', nip19.npubEncode(pubkey));

		$items = [];
		if (unsubscribe !== undefined) {
			unsubscribe();
		}
		followees =
			pubkey === $authorPubkey
				? $authorFollowees
				: await new Api(new SimplePool(), $readRelays).fetchFollowees(pubkey);
		timeline = new Timeline(pubkey, followees);
		unsubscribe = await timeline.subscribe();
		await load();
	}

	async function load() {
		console.log('[rx-nostr user following timeline load]', followees.length);

		if (followees.length === 0) {
			return;
		}

		let firstLength = $items.length;
		let count = 0;
		let until =
			$items.length > 0 ? Math.min(...$items.map((item) => item.event.created_at)) : now();
		let seconds = 15 * 60;

		while ($items.length - firstLength < minTimelineLength && count < 12) {
			const since = until - seconds;
			console.log(
				'[rx-nostr user following timeline period]',
				new Date(since * 1000),
				new Date(until * 1000)
			);

			const followeesFilters = Timeline.createChunkedFilters(followees, since, until);
			const relatedFilter = {
				kinds: [Kind.Text, 6, Kind.ChannelMessage],
				'#p': [pubkey],
				until,
				since
			};
			const filters = [...followeesFilters, relatedFilter];
			console.debug(
				'[rx-nostr user following timeline REQ]',
				filters,
				rxNostr.getAllRelayState()
			);
			const pastEventsReq = createRxOneshotReq({ filters });
			await new Promise<void>((resolve, reject) => {
				rxNostr
					.use(pastEventsReq)
					.pipe(
						uniq(),
						tap(({ event }: { event: Event }) => referencesReqEmit(event)),
						bufferTime(timelineBufferMs)
					)
					.subscribe({
						next: async (packets) => {
							console.debug('[rx-nostr user following timeline packets]', packets);
							packets.sort(reverseChronologicalItem);
							const newEventItems = packets
								.filter(({ event }) => event.created_at < until)
								.map(({ event }) => new EventItem(event));
							const duplicateEvents = newEventItems.filter((item) =>
								$items.some((x) => x.event.id === item.event.id)
							);
							if (duplicateEvents.length > 0) {
								console.warn(
									'[rx-nostr user following timeline duplicate events]',
									duplicateEvents
								);
							}
							$items.push(...newEventItems);
							$items = $items;
						},
						complete: () => {
							console.log('[rx-nostr user following timeline complete]');
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
				'[rx-nostr user following timeline loaded]',
				count,
				until,
				seconds / 3600,
				$items.length
			);
		}
	}
</script>

<TimelineView items={$items} readonly={!$authorPubkey} {load} />
