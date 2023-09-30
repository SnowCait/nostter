<script lang="ts">
	import { error } from '@sveltejs/kit';
	import { page } from '$app/stores';
	import { nip05, nip19, SimplePool, type Event } from 'nostr-tools';
	import {
		batch,
		createRxBackwardReq,
		createRxOneshotReq,
		latestEach,
		now,
		uniq
	} from 'rx-nostr';
	import { tap, bufferTime } from 'rxjs';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { metadataEvents } from '$lib/cache/Events';
	import type { User } from '../types';
	import { pool } from '../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';
	import { pubkey as authorPubkey, readRelays, rom } from '../../stores/Author';
	import { afterNavigate } from '$app/navigation';
	import FollowButton from '../action/FollowButton.svelte';
	import { Api } from '$lib/Api';
	import { BadgeApi, type Badge } from '$lib/BadgeApi';
	import Loading from '../Loading.svelte';
	import { User as UserDecoder } from '$lib/User';
	import { Timeline } from '$lib/Timeline';
	import MuteButton from '../action/MuteButton.svelte';
	import Badges from '../Badges.svelte';
	import Content from '../content/Content.svelte';
	import { EventItem, Metadata } from '$lib/Items';
	import { minTimelineLength, reverseChronologicalItem, timelineBufferMs } from '$lib/Constants';
	import IconTool from '@tabler/icons-svelte/dist/svelte/icons/IconTool.svelte';
	import IconDiscountCheck from '@tabler/icons-svelte/dist/svelte/icons/IconDiscountCheck.svelte';
	import IconAlertTriangle from '@tabler/icons-svelte/dist/svelte/icons/IconAlertTriangle.svelte';
	import UserStatus from '../parts/UserStatus.svelte';

	let metadata: Metadata;
	let user: User | undefined;
	let badges: Badge[] = []; // NIP-58 Badges
	let events: EventItem[] = [];
	let pubkey = '';
	let followees: string[] = [];
	let followers: string[] = [];
	let followeesLoading = true;
	let followersLoading = true;
	let timeline: Timeline;

	let relays = $readRelays;
	let slug = $page.params.npub;
	const api = new Api($pool, relays);

	const metadataReq = createRxBackwardReq();
	rxNostr
		.use(metadataReq.pipe(bufferTime(1000, null, 10), batch()))
		.pipe(latestEach(({ event }: { event: Event }) => event.pubkey))
		.subscribe(async (packet) => {
			const cache = metadataEvents.get(packet.event.pubkey);
			if (cache === undefined || cache.created_at < packet.event.created_at) {
				metadataEvents.set(packet.event.pubkey, packet.event);

				const metadata = new Metadata(packet.event);
				console.log('[rx-nostr metadata]', packet, metadata.content?.name);
				for (const item of events) {
					if (item.event.pubkey !== packet.event.pubkey) {
						continue;
					}
					item.metadata = metadata;
				}
				events = events;
			}
		});

	afterNavigate(async () => {
		slug = $page.params.npub;
		console.log('[profile page]', slug);

		const data = await UserDecoder.decode(slug);

		if (data.pubkey === undefined) {
			throw error(404);
		}

		if (pubkey === data.pubkey) {
			return;
		}

		badges = [];
		events = [];
		pubkey = data.pubkey;
		relays = Array.from(new Set([...relays, ...data.relays]));
		timeline = new Timeline(pubkey, [pubkey]);

		const event = await api.fetchUserEvent(pubkey);
		console.log('[metadata]', event);
		if (event !== undefined) {
			metadata = new Metadata(event);
			user = {
				...metadata.content,
				zapEndpoint: (await metadata.zapUrl())?.href ?? null
			} as User;
		}

		if (user !== undefined && user.nip05) {
			const normalizedNip05 = user.nip05.replace(/^_@/, '');
			if (slug !== normalizedNip05) {
				history.replaceState(history.state, '', normalizedNip05);
				slug = normalizedNip05;
			}
		}

		api.fetchFollowees(pubkey).then((pubkeys) => {
			followees = pubkeys;
			followeesLoading = false;
		});
		const longWaitApi = new Api(new SimplePool({ eoseSubTimeout: 10000 }), relays);
		longWaitApi.fetchFollowers(pubkey).then((pubkeys) => {
			followers = pubkeys;
			followersLoading = false;
		});
		const badgeApi = new BadgeApi();
		badgeApi.fetchBadges(relays, pubkey).then((data) => {
			badges = data;
		});
		await load();
	});

	async function load() {
		if (timeline === undefined) {
			return;
		}

		if (rxNostr.getRelays().length === 0) {
			await rxNostr.switchRelays(relays);
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
						next: async (packets) => {
							console.log('[rx-nostr user timeline packets]', packets);
							packets.sort(reverseChronologicalItem);
							const newEventItems = packets
								.filter(
									({ event }) =>
										since <= event.created_at && event.created_at < until
								)
								.map(
									({ event }) =>
										new EventItem(event, metadataEvents.get(event.pubkey))
								);
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
							console.log('[rx-nostr user timeline complete]');
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
				count,
				until,
				seconds / 3600,
				events.length
			);
		}
	}
</script>

<svelte:head>
	{#if user}
		<title>{user.display_name} (@{user.name}) - nostter</title>
	{:else}
		<title>ghost - nostter</title>
	{/if}
</svelte:head>

<section>
	<div class="banner">
		<img src={user?.banner} alt="" />
	</div>
	<div class="profile">
		<div class="actions">
			<div>
				<img src={user?.picture} alt="" />
			</div>
			{#if !$rom}
				{#if pubkey === $authorPubkey}
					<div class="profile-editor">
						<a href="/profile">
							<IconTool />
						</a>
					</div>
				{/if}
				<div class="mute">
					<MuteButton tagName="p" tagContent={pubkey} />
				</div>
				<div class="follow">
					<FollowButton {pubkey} />
				</div>
			{/if}
		</div>
		<h1>{user?.display_name ?? user?.name ?? ''}</h1>
		{#if user?.name}
			<h2>@{user.name}</h2>
		{/if}
		{#if user?.nip05}
			<div class="nip05">
				<span>{user.nip05}</span>
				{#await nip05.queryProfile(user.nip05) then pointer}
					{#if pointer !== null}
						<IconDiscountCheck color="skyblue" />
					{:else}
						<IconAlertTriangle color="red" />
					{/if}
				{/await}
			</div>
		{/if}

		<div class="user-status">
			<UserStatus {pubkey} showLink={true} />
		</div>
		<div class="nip19">{nip19.npubEncode(pubkey)}</div>
		<div class="nip19">{nip19.nprofileEncode({ pubkey })}</div>
		{#if followees.some((pubkey) => pubkey === $authorPubkey)}
			<div>Follows you</div>
		{/if}
		{#if user?.website}
			<div>
				<a href={user.website} target="_blank" rel="noreferrer">{user.website}</a>
			</div>
		{/if}
		{#if user?.about}
			<div class="about">
				<Content content={user.about} tags={metadata.event.tags} />
			</div>
		{/if}
	</div>
	<Badges {badges} />
	<div>
		Followees: {#if followeesLoading}
			<Loading />
		{:else}
			<a href={`/${slug}/followees`}>{followees.length}</a>
		{/if}
	</div>
	<div>
		Followers: {#if followersLoading}<Loading />{:else}{followers.length}+{/if}
	</div>
	<div>
		<a href="/{slug}/relays">Relays</a>
	</div>
	<div>
		<a href="/{slug}/timeline">Timeline</a>
	</div>
	<div>
		<a href="/{slug}/pins">PINs</a>
	</div>
	{#if pubkey === $authorPubkey}
		<div>
			<a href="/{slug}/reactions">Reactions</a>
		</div>
	{/if}
</section>

<section>
	<TimelineView items={events} readonly={!$authorPubkey} {load} />
</section>

<style>
	section + section {
		margin-top: 1rem;
	}

	.banner img {
		object-fit: cover;
		width: 100%;
		height: 200px;
	}

	.profile img {
		width: 128px;
		height: 128px;
		border-radius: 50%;
		margin-right: 12px;
		object-fit: cover;
	}

	.profile .actions {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
	}

	.profile .actions div {
		align-self: flex-end;
	}

	.profile .actions .profile-editor,
	.profile .actions .mute {
		margin-right: 1rem;
	}

	.profile .actions div:nth-child(2) {
		margin-left: auto;
	}

	.profile h1 {
		margin: 0;
	}

	.profile h2 {
		margin: 0;
		color: gray;
		font-size: 1em;
	}

	.about {
		margin: 1rem 0;
	}

	.nip05 {
		display: flex;
		flex-direction: row;
	}

	.nip05 span {
		margin-right: 0.2rem;
	}

	.nip19 {
		overflow: auto;
	}
</style>
