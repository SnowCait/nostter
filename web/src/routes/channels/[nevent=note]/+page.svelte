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
	import { tap, bufferTime, type Subscription } from 'rxjs';
	import { onDestroy } from 'svelte';
	import { nip19, type Event } from 'nostr-tools';
	import { error } from '@sveltejs/kit';
	import IconInfoCircle from '@tabler/icons-svelte/dist/svelte/icons/IconInfoCircle.svelte';
	import { page } from '$app/stores';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { cachedEvents, channelMetadataEvents, metadataEvents } from '$lib/cache/Events';
	import { Channel, channelIdStore } from '$lib/Channel';
	import { timeout } from '$lib/Constants';
	import type { ChannelMetadata } from '$lib/Types';
	import { author, readRelays } from '../../../stores/Author';
	import type { Event as ExtendedEvent, User } from '../../types';
	import Content from '../../content/Content.svelte';
	import TimelineView from '../../TimelineView.svelte';
	import { Metadata } from '$lib/Items';
	import { minTimelineLength, reverseChronologicalItem, timelineBufferMs } from '$lib/Constants';
	import PinChannel from './PinChannel.svelte';
	import ChannelTitle from '../../parts/ChannelTitle.svelte';
	import MuteButton from '../../action/MuteButton.svelte';

	let slug = $page.params.nevent;
	let channelId: string;
	// let author: string | undefined;
	let relays: string[];
	let kind40Event: Event | undefined;
	let kind41Event: Event | undefined;
	let channelMetadata: ChannelMetadata | undefined;

	let channelMessageSubscription: Subscription | undefined;
	let metadataSubscription: Subscription | undefined;

	let showInformation = false;

	$: console.log('[channel metadata]', channelMetadata);

	function updateChannelMetadata(): void {
		console.log('[channel metadata update]', slug);
		const { type, data } = nip19.decode(slug);
		if (type !== 'nevent') {
			console.error('[channel page decode error]', slug);
			throw error(404);
		}

		const pointer = data as nip19.EventPointer;
		channelId = pointer.id;
		// author = pointer.author;
		relays = pointer.relays ?? [];

		kind40Event = cachedEvents.get(channelId);
		kind41Event = channelMetadataEvents.get(channelId);
		console.log('[channel metadata cache 40]', kind40Event);
		console.log('[channel metadata cache 41]', kind41Event);

		if (kind40Event === undefined) {
			return;
		}

		$channelIdStore = channelId;

		if (kind41Event !== undefined && kind40Event.pubkey === kind41Event.pubkey) {
			channelMetadata = Channel.parseMetadata(kind41Event);
		} else {
			channelMetadata = Channel.parseMetadata(kind40Event);
		}
	}

	const rxNostr = createRxNostr({ timeout });
	const metadataReq = createRxBackwardReq();

	let events: ExtendedEvent[] = [];

	afterNavigate(async () => {
		slug = $page.params.nevent;
		console.log('[channel page after navigate]', slug, channelId);
		updateChannelMetadata();
		await rxNostr.switchRelays([...$readRelays, ...relays]);
		console.log('[channel relays]', rxNostr.getRelays());

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

		rxNostr
			.use(channelMetadataReq)
			.pipe(uniq(), latest())
			.subscribe((packet) => {
				console.log('[channel metadata event]', packet);

				if (packet.event.kind === 41) {
					channelMetadataEvents.set(channelId, packet.event);
				} else {
					cachedEvents.set(packet.event.id, packet.event);
				}

				updateChannelMetadata();
			});

		const channelMessageReq = createRxForwardReq();

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
				})
			)
			.subscribe((packet) => {
				console.debug('[channel message event]', packet);
				const { event } = packet;
				const metadataEvent = metadataEvents.get(event.pubkey);
				if (metadataEvent !== undefined) {
					const metadata = new Metadata(metadataEvent);
					events.unshift({
						...event,
						user: metadata.content
					} as ExtendedEvent);
				} else {
					events.unshift(event as ExtendedEvent);
				}
				events = events;
			});

		channelMessageReq.emit({ kinds: [42], '#e': [channelId], since: now() });

		if (metadataSubscription !== undefined) {
			console.debug('[channel page already subscribe metadata]');
		} else {
			metadataSubscription = rxNostr
				.use(metadataReq.pipe(bufferTime(1000), batch()))
				.pipe(latestEach(({ event }: { event: Event }) => event.pubkey))
				.subscribe(async (packet) => {
					const cache = metadataEvents.get(packet.event.pubkey);
					if (cache === undefined || cache.created_at < packet.event.created_at) {
						metadataEvents.set(packet.event.pubkey, packet.event);

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
					}
				});
		}

		await load();
	});

	beforeNavigate(() => {
		console.log('[channel page before navigate]', slug, channelId);
		channelMessageSubscription?.unsubscribe();
		events = [];
	});

	onDestroy(() => {
		console.log('[channel page on destroy]', slug);
		rxNostr.dispose();
		$channelIdStore = undefined;
	});

	async function load() {
		console.log('[channel page load]', slug, channelId);
		if (channelId === undefined) {
			return;
		}

		const firstLength = events.length;
		let count = 0;
		let until =
			events.length > 0
				? Math.min(...events.map((event) => event.created_at))
				: Math.floor(Date.now() / 1000);
		let seconds = 24 * 60 * 60;

		while (events.length - firstLength < minTimelineLength && count < 10) {
			const since = until - seconds;
			const filter = { kinds: [42], '#e': [channelId], until, since };
			console.debug('[channel messages REQ]', filter);
			const pastChannelMessageReq = createRxOneshotReq({ filters: filter });
			await new Promise<void>((resolve, reject) => {
				rxNostr
					.use(pastChannelMessageReq)
					.pipe(
						uniq(),
						tap(({ event }: { event: Event }) => {
							metadataReq.emit({
								kinds: [0],
								authors: [event.pubkey],
								limit: 1
							});
						}),
						bufferTime(timelineBufferMs)
					)
					.subscribe({
						next: (packets) => {
							console.debug('[channel messages]', packets);
							packets.sort(reverseChronologicalItem);
							events.push(
								...packets
									.filter(({ event }) => event.created_at < until)
									.map(({ event }) => {
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
						},
						complete: () => {
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
			console.log('[channel load]', count, until, seconds / 3600, events.length);
		}
	}
</script>

<header>
	<section class="title">
		<h1><ChannelTitle {channelMetadata} /></h1>
		<div>
			<button
				class="clear"
				on:click={() => {
					showInformation = !showInformation;
				}}
			>
				<IconInfoCircle />
			</button>
		</div>
		{#if $author !== undefined && channelId !== undefined}
			<div class="pin"><PinChannel {channelId} /></div>
			<div class="mute"><MuteButton tagName="e" tagContent={channelId} text="channel" /></div>
		{/if}
	</section>
	{#if showInformation}
		<section>
			<div class="channel-id">ID: {channelId}</div>
			{#if channelMetadata?.about}
				<div class="channel-about">
					<Content content={channelMetadata.about} tags={[]} />
				</div>
			{/if}
			<div class="external-link">
				Open in <a
					href="https://coracle.social/chat/{nip19.noteEncode(channelId)}"
					target="_blank"
					rel="noopener noreferrer"
				>
					Coracle
				</a>
				<a
					href="https://unyu-house.vercel.app/channels/{nip19.neventEncode({
						id: channelId
					})}"
					target="_blank"
					rel="noopener noreferrer"
				>
					うにゅうハウス
				</a>
				<a
					href="https://garnet.nostrian.net/channels/{channelId}"
					target="_blank"
					rel="noopener noreferrer"
				>
					GARNET
				</a>
				<a
					href="https://www.nostrchat.io/channel/{channelId}"
					target="_blank"
					rel="noopener noreferrer"
				>
					NostrChat
				</a>
			</div>
		</section>
	{/if}
</header>

<TimelineView {events} {load} />

<style>
	header {
		position: sticky;
		top: 0;
		background-color: white;
		margin: 0;
		padding: 0.5rem 1rem;
	}

	.title {
		display: flex;
		flex-direction: row;
		align-items: center;
	}

	section {
		margin-bottom: 0.5rem;
	}

	h1 {
		margin: 0;
	}

	.title div {
		margin-left: 1rem;
	}

	button {
		color: var(--accent-gray);
	}

	.channel-id {
		color: gray;
		font-size: 0.6rem;
	}

	.channel-about {
		margin: 0.5rem 0;
	}
</style>
