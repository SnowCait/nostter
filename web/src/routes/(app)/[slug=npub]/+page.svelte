<script lang="ts">
	import { page } from '$app/stores';
	import { type Event, nip05, nip19 } from 'nostr-tools';
	import { createRxOneshotReq, now, uniq } from 'rx-nostr';
	import { tap, bufferTime } from 'rxjs';
	import { metadataStore } from '$lib/cache/Events';
	import { metadataReqEmit, referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import { normalizeNip05 } from '$lib/MetadataHelper';
	import TimelineView from '../TimelineView.svelte';
	import { pubkey as authorPubkey, readRelays } from '../../../stores/Author';
	import { afterNavigate } from '$app/navigation';
	import { Timeline } from '$lib/Timeline';
	import { EventItem, Metadata, type MetadataContent } from '$lib/Items';
	import { minTimelineLength, reverseChronologicalItem, timelineBufferMs } from '$lib/Constants';
	import type { LayoutData } from './$types';
	import Profile from '$lib/components/Profile.svelte';

	export let data: LayoutData;

	let metadata: Metadata | undefined;
	let user: MetadataContent | undefined;
	let events: EventItem[] = [];
	let pubkey: string | undefined;

	let relays = $readRelays;
	let slug = $page.params.slug;

	$: if (metadata === undefined || metadata.event.pubkey !== data.pubkey) {
		console.log('[npub metadata]', nip19.npubEncode(data.pubkey));
		metadata = $metadataStore.get(data.pubkey);
		if (metadata === undefined) {
			metadataReqEmit([data.pubkey]);
		} else {
			if (user !== undefined && user.nip05) {
				const normalizedNip05 = normalizeNip05(user.nip05);
				if (slug !== normalizedNip05) {
					nip05.queryProfile(normalizedNip05).then((pointer) => {
						if (pointer !== null) {
							history.replaceState(history.state, '', normalizedNip05);
							slug = normalizedNip05;
						} else {
							console.warn('[invalid NIP-05]', normalizedNip05);
						}
					});
				}
			}
		}
	}

	afterNavigate(async () => {
		slug = $page.params.slug;
		console.log('[profile page]', slug);

		if (pubkey === data.pubkey) {
			return;
		}

		events = [];
		pubkey = data.pubkey;
		relays = Array.from(new Set([...relays, ...data.relays]));

		await load();
	});

	async function load() {
		if (pubkey === undefined) {
			return;
		}

		let firstLength = events.length;
		let count = 0;
		let until =
			events.length > 0 ? Math.min(...events.map((item) => item.event.created_at)) : now();
		let seconds = 12 * 60 * 60;

		while (events.length - firstLength < minTimelineLength && count < 10) {
			const since = until - seconds;
			console.log(
				'[rx-nostr user timeline period]',
				new Date(since * 1000),
				new Date(until * 1000)
			);

			const filters = Timeline.createChunkedFilters([pubkey], since, until);
			console.log('[rx-nostr user timeline REQ]', filters, rxNostr.getAllRelayState());
			const pastEventsReq = createRxOneshotReq({ filters });
			console.log(
				'[rx-nostr user timeline req ID]',
				pastEventsReq.strategy,
				pastEventsReq.rxReqId
			);
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
							console.log('[rx-nostr user timeline packets]', packets);
							packets.sort(reverseChronologicalItem);
							const newEventItems = packets
								.filter(
									({ event }) =>
										since <= event.created_at && event.created_at < until
								)
								.map(({ event }) => new EventItem(event));
							const duplicateEvents = newEventItems.filter((item) =>
								events.some((x) => x.event.id === item.event.id)
							);
							if (duplicateEvents.length > 0) {
								console.warn(
									'[rx-nostr user timeline duplicate events]',
									duplicateEvents
								);
							}
							events.push(
								...newEventItems.filter(
									(item) => !events.some((x) => x.event.id === item.event.id)
								)
							);
							events = events;
						},
						complete: () => {
							console.log('[rx-nostr user timeline complete]', pastEventsReq.rxReqId);
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
				'[rx-nostr user timeline loaded]',
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
	{#if metadata !== undefined}
		<title>
			{user?.display_name ?? user?.name} (@{user?.name ?? user?.display_name}) - nostter
		</title>
	{:else}
		<title>ghost - nostter</title>
	{/if}
</svelte:head>

<section class="card profile-wrapper">
	<Profile {slug} {metadata} {relays} />
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
