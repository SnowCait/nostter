<script lang="ts">
	import {
		batch,
		createRxBackwardReq,
		createRxForwardReq,
		createRxNostr,
		createRxOneshotReq,
		latest,
		latestEach,
		now,
		uniq
	} from 'rx-nostr';
	import { tap, bufferTime, Subscription } from 'rxjs';
	import { afterUpdate, onDestroy, onMount } from 'svelte';
	import { nip19, type Event } from 'nostr-tools';
	import { error } from '@sveltejs/kit';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { cachedEvents, channelMetadataEvents, metadataEvents } from '$lib/cache/Events';
	import { Channel } from '$lib/Channel';
	import type { ChannelMetadata } from '$lib/Types';
	import { readRelays } from '../../../stores/Author';
	import type { Event as ExtendedEvent, User } from '../../types';
	import Content from '../../content/Content.svelte';
	import TimelineView from '../../TimelineView.svelte';
	import type { NostrURI } from 'nostr-tools/lib/nip21';
	import { Metadata } from '$lib/Items';

	const slug = $page.params.nevent;
	let channelId: string;
	// let author: string | undefined;
	let relays: string[];
	let kind40Event: Event | undefined;
	let kind41Event: Event | undefined;
	let channelMetadata: ChannelMetadata | undefined;
	let channelMetadataSubscription: Subscription;
	let channelMessageSubscription: Subscription;
	let metadataSubscription: Subscription;

	$: console.log('[channel metadata]', channelMetadata);
	$: {
		const { data, type } = nip19.decode(slug);
		if (type !== 'nevent') {
			console.error('[channel page decode error]', slug);
			throw error(404);
		}

		const pointer = data as nip19.EventPointer;
		channelId = pointer.id;
		// author = pointer.author;
		relays = pointer.relays ?? [];

		kind40Event = cachedEvents.get(channelId);
		console.log('[channel metadata cache 40]', kind40Event);
		if (kind40Event !== undefined) {
			channelMetadata = Channel.parseMetadata(kind40Event);
		}

		kind41Event = channelMetadataEvents.get(channelId);
		console.log('[channel metadata cache 41]', kind41Event);
		if (kind41Event !== undefined) {
			channelMetadata = Channel.parseMetadata(kind41Event);
		}
	}

	const rxNostr = createRxNostr();

	let events: ExtendedEvent[] = [];

	onMount(async () => {
		console.log('[channel page on mount]', slug, channelId);
		await rxNostr.switchRelays([...$readRelays, ...relays]);

		const kind40Filter = {
			kinds: [40],
			ids: [channelId]
		};
		const kind41Filter = {
			kinds: [41],
			'#e': [channelId]
		};
		const channelMetadataReq = createRxOneshotReq({
			filters: kind40Event === undefined ? [kind40Filter, kind41Filter] : [kind41Filter]
		});

		channelMetadataSubscription = rxNostr
			.use(channelMetadataReq)
			.pipe(uniq(), latest())
			.subscribe((packet) => {
				console.log('[channel metadata event]', packet);
				channelMetadata = Channel.parseMetadata(packet.event);
				if (packet.event.kind === 41) {
					channelMetadataEvents.set(channelId, packet.event);
				} else {
					cachedEvents.set(packet.event.id, packet.event);
				}
			});

		const channelMessageReq = createRxForwardReq();
		const metadataReq = createRxBackwardReq();

		channelMessageSubscription = rxNostr
			.use(channelMessageReq)
			.pipe(
				uniq(),
				tap(({ event }: { event: Event }) => {
					metadataReq.emit({
						kinds: [0],
						authors: [event.pubkey],
						limit: 1
					});
				}),
				bufferTime(1500)
			)
			.subscribe((packets) => {
				console.debug('[channel message events]', packets.length);
				packets.sort((x, y) => x.event.created_at - y.event.created_at);
				events.unshift(
					...packets.reverse().map(({ event }) => {
						const metadataEvent = metadataEvents.get(event.pubkey);
						if (metadataEvent !== undefined) {
							const metadata = new Metadata(metadataEvent);
							return {
								...event,
								user: metadata.content
							} as ExtendedEvent;
						} else {
							return event as ExtendedEvent;
						}
					})
				);
				events = events;
			});

		channelMessageReq.emit({ kinds: [42], '#e': [channelId], since: now() - 24 * 60 * 60 });

		metadataSubscription = rxNostr
			.use(metadataReq.pipe(bufferTime(1000), batch()))
			.pipe(latestEach(({ event }: { event: Event }) => event.pubkey))
			.subscribe(async (packet) => {
				const metadata = new Metadata(packet.event);
				console.log('[channel related metadata]', packet, metadata.content?.name);
				const user = {
					...metadata.content,
					zapEndpoint: (await metadata.zapUrl())?.href ?? null
				} as User;
				for (const event of events) {
					if (event.pubkey !== packet.event.pubkey) {
						continue;
					}
					event.user = user;
				}
				events = events;

				const cache = metadataEvents.get(packet.event.pubkey);
				if (cache === undefined || cache.created_at < packet.event.created_at) {
					metadataEvents.set(packet.event.pubkey, packet.event);
				}
			});
	});

	onDestroy(() => {
		console.log('[channel page on destroy]', slug);
		channelMetadataSubscription.unsubscribe();
		channelMessageSubscription.unsubscribe();
		metadataSubscription.unsubscribe();
		rxNostr.dispose();
	});
</script>

<h1>{channelMetadata?.name ?? ''}</h1>
<div class="channel-id">ID: {channelId}</div>
{#if channelMetadata?.about}
	<div class="channel-about">
		<Content content={channelMetadata.about} tags={[]} />
	</div>
{/if}

<TimelineView {events} load={async () => console.debug()} showLoading={false} />

<style>
	h1 {
		position: sticky;
		top: 0;
		background-color: white;
		margin: 0;
		padding: 0.5rem 1rem;
	}

	div {
		margin-left: 1rem;
	}

	.channel-id {
		color: gray;
		font-size: 0.6rem;
	}

	.channel-about {
		margin: 1rem;
	}
</style>
