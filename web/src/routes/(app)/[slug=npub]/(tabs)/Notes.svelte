<script lang="ts">
	import { createRxOneshotReq, now, uniq } from 'rx-nostr';
	import { tap } from 'rxjs';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { referencesReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import { pubkey as authorPubkey } from '$lib/stores/Author';
	import { Timeline } from '$lib/Timeline';
	import { EventItem } from '$lib/Items';
	import { minTimelineLength } from '$lib/Constants';
	import TimelineView from '../../TimelineView.svelte';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	let items = $state<EventItem[]>([]);

	async function load() {
		console.debug('[npub page timeline load]', pubkey);

		let firstLength = items.length;
		let count = 0;
		let until =
			items.length > 0 ? Math.min(...items.map((item) => item.event.created_at)) : now();
		let seconds = 12 * 60 * 60;

		while (items.length - firstLength < minTimelineLength && count < 10) {
			const since = until - seconds;
			console.debug(
				'[rx-nostr user timeline period]',
				new Date(since * 1000),
				new Date(until * 1000)
			);

			const filters = Timeline.createChunkedFilters([pubkey], since, until);
			console.debug('[rx-nostr user timeline REQ]', filters, rxNostr.getAllRelayStatus());
			const pastEventsReq = createRxOneshotReq({ filters });
			console.debug('[rx-nostr user timeline req ID]', pastEventsReq);
			await new Promise<void>((resolve, reject) => {
				rxNostr
					.use(pastEventsReq)
					.pipe(
						tie,
						uniq(),
						tap(({ event }) => {
							referencesReqEmit(event);
							authorActionReqEmit(event);
						})
					)
					.subscribe({
						next: (packet) => {
							console.debug('[rx-nostr user timeline packet]', packet);
							if (
								!(
									since <= packet.event.created_at &&
									packet.event.created_at < until
								)
							) {
								console.warn(
									'[rx-nostr user timeline out of period]',
									packet,
									since,
									until
								);
								return;
							}
							if (items.some((x) => x.event.id === packet.event.id)) {
								console.warn('[rx-nostr user timeline duplicate]', packet.event);
								return;
							}
							const item = new EventItem(packet.event);
							const index = items.findIndex(
								(x) => x.event.created_at < item.event.created_at
							);
							if (index < 0) {
								items.push(item);
							} else {
								items.splice(index, 0, item);
							}
							items = items;
						},
						complete: () => {
							console.debug(
								'[rx-nostr user timeline complete]',
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
			console.debug(
				'[rx-nostr user timeline loaded]',
				pastEventsReq.rxReqId,
				count,
				until,
				seconds / 3600,
				items.length
			);
		}
	}
</script>

<section>
	<TimelineView {items} readonly={!$authorPubkey} {load} />
</section>
