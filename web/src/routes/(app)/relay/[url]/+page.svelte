<script lang="ts">
	import { createRxOneshotReq, now } from 'rx-nostr';
	import { tap } from 'rxjs';
	import { afterNavigate } from '$app/navigation';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import { pubkey as authorPubkey } from '$lib/stores/Author';
	import { EventItem } from '$lib/Items';
	import { appName, minTimelineLength } from '$lib/Constants';
	import type { LayoutData } from './$types';
	import TimelineView from '../../TimelineView.svelte';
	import Relay from '$lib/components/items/Relay.svelte';

	export let data: LayoutData;

	let events: EventItem[] = [];

	afterNavigate(() => {
		console.debug('[relay page]', data.url);
		events = [];
	});

	async function load() {
		console.log('[relay page timeline load]', data.url);

		let firstLength = events.length;
		let count = 0;
		let until =
			events.length > 0 ? Math.min(...events.map((item) => item.event.created_at)) : now();
		let seconds = 12 * 60 * 60;

		while (events.length - firstLength < minTimelineLength && count < 10) {
			const since = until - seconds;
			console.log(
				'[rx-nostr relay timeline period]',
				new Date(since * 1000),
				new Date(until * 1000)
			);

			const pastEventsReq = createRxOneshotReq({ filters: [{ kinds: [1], since, until }] });
			console.log('[rx-nostr relay timeline req ID]', pastEventsReq);
			await new Promise<void>((resolve, reject) => {
				rxNostr
					.use(pastEventsReq, {
						on: {
							relays: ['ws' + data.url.substring(4)],
							defaultReadRelays: false
						}
					})
					.pipe(
						tap(({ event }) => {
							referencesReqEmit(event);
							authorActionReqEmit(event);
						})
					)
					.subscribe({
						next: (packet) => {
							console.log('[rx-nostr relay timeline packet]', packet);
							if (
								!(
									since <= packet.event.created_at &&
									packet.event.created_at < until
								)
							) {
								console.warn(
									'[rx-nostr relay timeline out of period]',
									packet,
									since,
									until
								);
								return;
							}
							if (events.some((x) => x.event.id === packet.event.id)) {
								console.warn('[rx-nostr relay timeline duplicate]', packet.event);
								return;
							}
							const item = new EventItem(packet.event);
							const index = events.findIndex(
								(x) => x.event.created_at < item.event.created_at
							);
							if (index < 0) {
								events.push(item);
							} else {
								events.splice(index, 0, item);
							}
							events = events;
						},
						complete: () => {
							console.log(
								'[rx-nostr relay timeline complete]',
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
			console.log(
				'[rx-nostr relay timeline loaded]',
				pastEventsReq.rxReqId,
				count,
				until,
				seconds / 3600,
				events.length
			);
		}
	}
</script>

<svelte:head>
	<title>{appName} - {data.name} ~ {data.hostname}</title>
	<meta property="og:title" content={data.name} />
	<meta property="og:description" content={data.description} />
	<meta property="og:image" content={data.icon} />
</svelte:head>

<section class="card profile-wrapper">
	<Relay {...data} />
</section>

<section>
	<TimelineView items={events} readonly={!$authorPubkey} {load} />
</section>

<style>
	.profile-wrapper {
		position: relative;
	}

	section + section {
		margin-top: 1rem;
	}

	@media screen and (max-width: 600px) {
		section + section {
			margin-top: 0;
		}
	}
</style>
