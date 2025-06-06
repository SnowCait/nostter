<script lang="ts">
	import {
		createRxForwardReq,
		createRxNostr,
		createRxOneshotReq,
		createRxBackwardReq,
		latest,
		now,
		uniq,
		type LazyFilter
	} from 'rx-nostr';
	import { tap, type Subscription, filter } from 'rxjs';
	import { onDestroy } from 'svelte';
	import { nip19, type Event } from 'nostr-tools';
	import { _ } from 'svelte-i18n';
	import { error } from '@sveltejs/kit';
	import IconInfoCircle from '@tabler/icons-svelte/icons/info-circle';
	import { page } from '$app/stores';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { cachedEvents, channelMetadataEventsStore, metadataStore } from '$lib/cache/Events';
	import { Channel, channelIdStore } from '$lib/Channel';
	import { appName, timeout } from '$lib/Constants';
	import { fetchEvents } from '$lib/RxNostrHelper';
	import type { ChannelMetadata } from '$lib/Types';
	import { referencesReqEmit, tie, verificationClient } from '$lib/timelines/MainTimeline';
	import { author, readRelays } from '$lib/stores/Author';
	import Content from '$lib/components/Content.svelte';
	import TimelineView from '../../TimelineView.svelte';
	import { EventItem } from '$lib/Items';
	import { minTimelineLength } from '$lib/Constants';
	import PinChannel from './PinChannel.svelte';
	import ChannelTitle from '$lib/components/ChannelTitle.svelte';
	import MuteButton from '$lib/components/MuteButton.svelte';
	import { oldestCreatedAt } from '$lib/timelines/TimelineHelper';

	let slug = $page.params.nevent;
	let channelId: string;
	// let author: string | undefined;
	let relays: string[];
	let kind40Event: Event | undefined;
	let kind41Event: Event | undefined;
	let channelMetadata: ChannelMetadata | undefined;

	let channelMessageSubscription: Subscription | undefined;

	let showInformation = false;

	$: metadata = kind40Event !== undefined ? $metadataStore.get(kind40Event.pubkey) : undefined;
	$: console.log('[channel metadata]', channelMetadata);

	function updateChannelMetadata(): void {
		console.log('[channel metadata update]', slug);
		const { type, data } = nip19.decode(slug);
		if (type !== 'nevent') {
			console.error('[channel page decode error]', slug);
			error(404);
		}

		const pointer = data as nip19.EventPointer;
		channelId = pointer.id;
		// author = pointer.author;
		relays = pointer.relays ?? [];

		kind40Event = cachedEvents.get(channelId);
		kind41Event = $channelMetadataEventsStore.get(channelId);
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

	const rxNostr = createRxNostr({ verifier: verificationClient.verifier, eoseTimeout: timeout });

	let items: EventItem[] = [];

	afterNavigate(async () => {
		slug = $page.params.nevent;
		console.log('[channel page after navigate]', slug, channelId);
		updateChannelMetadata();
		rxNostr.setDefaultRelays([...$readRelays, ...relays]);
		console.log('[channel relays]', rxNostr.getDefaultRelays());

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
			.pipe(tie, uniq(), latest())
			.subscribe((packet) => {
				console.log('[channel metadata event]', packet);

				if (packet.event.kind === 41) {
					$channelMetadataEventsStore.set(channelId, packet.event);
				} else {
					cachedEvents.set(packet.event.id, packet.event);
				}

				updateChannelMetadata();
			});

		const channelMessageReq = createRxForwardReq();

		channelMessageSubscription = rxNostr
			.use(channelMessageReq)
			.pipe(
				tie,
				uniq(),
				tap(({ event }: { event: Event }) => referencesReqEmit(event))
			)
			.subscribe(async (packet) => {
				console.debug('[channel message event]', packet);
				const { event } = packet;
				items.unshift(new EventItem(event));
				items = items;
			});

		channelMessageReq.emit({ kinds: [42], '#e': [channelId], since: now() });

		await load();
	});

	beforeNavigate(() => {
		console.log('[channel page before navigate]', slug, channelId);
		channelMessageSubscription?.unsubscribe();
		items = [];
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

		const firstLength = items.length;
		const filterBase: LazyFilter = { kinds: [42], '#e': [channelId] };
		console.debug('[rx-nostr channel messages REQ]', filterBase);

		const { promise, resolve } = Promise.withResolvers<void>();
		const req = createRxBackwardReq();
		rxNostr
			.use(req)
			.pipe(
				tie,
				uniq(),
				filter(({ event }) => !items.some((item) => item.event.id === event.id)),
				tap(({ event }) => referencesReqEmit(event))
			)
			.subscribe({
				next: ({ event }) => {
					console.debug('[rx-nostr channel message next]', event);
					const item = new EventItem(event);
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
					console.debug('[rx-nostr channel message complete]', firstLength, items.length);
					resolve();
				}
			});
		const until = oldestCreatedAt(items);
		req.emit([{ ...filterBase, until, since: until - 15 * 60 }]);
		req.over();
		await promise;

		const length = items.length - firstLength;
		if (length < minTimelineLength) {
			const limit = minTimelineLength - length;
			const events = await fetchEvents([
				{ ...filterBase, until: oldestCreatedAt(items), limit }
			]);
			items.push(
				...events
					.filter((event) => !items.some((item) => item.event.id === event.id))
					.splice(0, limit)
					.map((event) => new EventItem(event))
			);
			items = items;
		}

		console.log('[rx-nostr channel message loaded]', firstLength, items.length);
	}
</script>

<svelte:head>
	<title>{appName} - {channelMetadata?.name ?? $_('layout.header.channels')}</title>
</svelte:head>

<header class="card">
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
			{#if metadata !== undefined}
				<div>
					Created by <a href="/{nip19.npubEncode(metadata.event.pubkey)}">
						{metadata.displayName} @{metadata.name}
					</a>
				</div>
			{/if}
		</section>
	{/if}
</header>

<TimelineView {items} {load} />

<style>
	header {
		position: sticky;
		top: 0;
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

	a {
		text-decoration: underline;
	}
</style>
