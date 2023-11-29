<script lang="ts">
	import { createRxOneshotReq, now, uniq } from 'rx-nostr';
	import { tap } from 'rxjs';
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
	import { minTimelineLength } from '$lib/Constants';
	import { rxNostr, referencesReqEmit } from '$lib/timelines/MainTimeline';
	import { EventItem } from '$lib/Items';

	let pubkey: string | undefined;
	let followees: string[] = [];
	let timeline: Timeline;
	let unsubscribe: () => void;

	export async function initialize(p: string): Promise<void> {
		pubkey = p;
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

		if (pubkey === undefined || followees.length === 0) {
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
						tap(({ event }: { event: Event }) => referencesReqEmit(event))
					)
					.subscribe({
						next: async (packet) => {
							console.debug('[rx-nostr user following timeline packet]', packet);
							if (
								!(
									since <= packet.event.created_at &&
									packet.event.created_at < until
								)
							) {
								console.warn(
									'[rx-nostr user following timeline out of period]',
									packet,
									since,
									until
								);
								return;
							}
							if ($items.some((x) => x.event.id === packet.event.id)) {
								console.warn(
									'[rx-nostr user following timeline duplicate]',
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
