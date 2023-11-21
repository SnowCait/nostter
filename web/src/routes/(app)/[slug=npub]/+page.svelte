<script lang="ts">
	import { page } from '$app/stores';
	import { type Event, nip05, nip19 } from 'nostr-tools';
	import { createRxOneshotReq, now, uniq } from 'rx-nostr';
	import { tap } from 'rxjs';
	import { metadataStore } from '$lib/cache/Events';
	import { metadataReqEmit, referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import { normalizeNip05 } from '$lib/MetadataHelper';
	import TimelineView from '../TimelineView.svelte';
	import { pubkey as authorPubkey, readRelays } from '../../../stores/Author';
	import { Timeline } from '$lib/Timeline';
	import { EventItem, Metadata } from '$lib/Items';
	import { appName, minTimelineLength } from '$lib/Constants';
	import type { LayoutData } from './$types';
	import Profile from '$lib/components/Profile.svelte';

	export let data: LayoutData;

	let metadata: Metadata | undefined;
	let events: EventItem[] = [];

	let relays = $readRelays;
	let slug = $page.params.slug;

	$: if (metadata === undefined || metadata.event.pubkey !== data.pubkey) {
		console.log('[npub metadata]', nip19.npubEncode(data.pubkey));

		events = [];
		relays = [...new Set([...$readRelays, ...data.relays])];

		metadata = $metadataStore.get(data.pubkey);
		if (metadata === undefined) {
			metadataReqEmit([data.pubkey]);
		} else {
			referencesReqEmit(metadata.event);
			overwriteSlug();
		}
	}

	function overwriteSlug() {
		if (metadata?.content === undefined || !metadata.content.nip05) {
			return;
		}

		const normalizedNip05 = normalizeNip05(metadata.content.nip05);
		if (slug === normalizedNip05) {
			return;
		}

		nip05.queryProfile(normalizedNip05).then((pointer) => {
			if (pointer !== null) {
				history.replaceState(history.state, '', normalizedNip05);
				slug = normalizedNip05;
			} else {
				console.warn('[invalid NIP-05]', normalizedNip05);
			}
		});
	}

	async function load() {
		console.log('[npub page timeline load]', data.pubkey);

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

			const filters = Timeline.createChunkedFilters([data.pubkey], since, until);
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
						tap(({ event }: { event: Event }) => referencesReqEmit(event))
					)
					.subscribe({
						next: async (packet) => {
							console.log('[rx-nostr user timeline packet]', packet);
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
							if (events.some((x) => x.event.id === packet.event.id)) {
								console.warn('[rx-nostr user timeline duplicate]', packet.event);
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
		<title>{appName} - {metadata.displayName} (@{metadata.name})</title>
		<meta property="og:image" content={metadata.picture} />
	{:else}
		<title>{appName} - ghost</title>
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
