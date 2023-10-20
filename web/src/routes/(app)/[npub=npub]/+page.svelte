<script lang="ts">
	import { error } from '@sveltejs/kit';
	import { page } from '$app/stores';
	import { SimplePool, type Event } from 'nostr-tools';
	import { createRxOneshotReq, now, uniq } from 'rx-nostr';
	import { tap, bufferTime } from 'rxjs';
	import { metadataStore } from '$lib/cache/Events';
	import { referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import { normalizeNip05 } from '$lib/MetadataHelper';
	import { pool } from '../../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';
	import { pubkey as authorPubkey, readRelays, rom } from '../../../stores/Author';
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
	import { EventItem, Metadata, type MetadataContent } from '$lib/Items';
	import { minTimelineLength, reverseChronologicalItem, timelineBufferMs } from '$lib/Constants';
	import IconTool from '@tabler/icons-svelte/dist/svelte/icons/IconTool.svelte';
	import UserStatus from '../parts/UserStatus.svelte';
	import NostrAddress from '../[npub=npub]/NostrAddress.svelte';

	let metadata: Metadata | undefined;
	let user: MetadataContent | undefined;
	let badges: Badge[] = []; // NIP-58 Badges
	let events: EventItem[] = [];
	let pubkey: string | undefined;
	let followees: string[] = [];
	let followers: string[] = [];
	let followeesLoading = true;
	let followersLoading = true;
	let timeline: Timeline;

	let relays = $readRelays;
	let slug = $page.params.npub;
	const api = new Api($pool, relays);

	$: if (metadata !== undefined) {
		user = metadata.content;
		if (user !== undefined && user.nip05) {
			const normalizedNip05 = normalizeNip05(user.nip05);
			if (slug !== normalizedNip05) {
				history.replaceState(history.state, '', normalizedNip05);
				slug = normalizedNip05;
			}
		}
	}

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

		metadata = $metadataStore.get(pubkey);
		if (metadata === undefined) {
			const event = await api.fetchUserEvent(pubkey);
			console.log('[metadata]', event);
			if (event !== undefined) {
				metadata = new Metadata(event);
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
		if (timeline === undefined || pubkey === undefined) {
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
		<title>{user?.display_name ?? user?.name} (@{user?.name ?? user?.display_name}) - nostter</title>
	{:else}
		<title>ghost - nostter</title>
	{/if}
</svelte:head>

<section class="card profile-wrapper">
	<div class="banner">
		{#if user?.banner}
			<img src={user.banner} alt="" />
		{:else}
			<div class="blank" />
		{/if}
	</div>
	<div class="user-info">
		<div class="profile">
			<div class="actions">
				<div class="picture-wrapper">
					{#if metadata !== undefined}
						<img src={metadata?.picture} alt="" />
					{:else}
						<div class="blank" />
					{/if}
				</div>
				<div class="buttons">
					{#if !$rom && pubkey !== undefined}
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
						<FollowButton {pubkey} />
					{/if}
				</div>
			</div>
			<h1>{user?.display_name ?? user?.name ?? ''}</h1>
			<div class="user-name-wrapper">
				{#if user?.name}
					<h2>@{user.name}</h2>
				{/if}
				{#if followees.some((pubkey) => pubkey === $authorPubkey)}
					<p>Follows you</p>
				{/if}
			</div>

			{#if pubkey !== undefined}
				<div class="user-status">
					<UserStatus {pubkey} showLink={true} />
				</div>
			{/if}

			{#if metadata !== undefined}
				<NostrAddress {metadata} />
			{/if}

			{#if user?.website}
				<div>
					<a href={user.website} target="_blank" rel="noreferrer">{user.website}</a>
				</div>
			{/if}
			{#if user?.about}
				<div class="about">
					<Content content={user.about} tags={metadata?.event.tags ?? []} />
				</div>
			{/if}
		</div>
		<Badges {badges} />
		<div class="relationships">
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
		<div>
			<a href="/{slug}/reactions">Reactions</a>
		</div>
	</div>
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

	.banner {
		position: absolute;
		width: 100%;
		left: 0;
		top: 0;
		z-index: 0;
	}

	.banner img,
	.banner .blank {
		object-fit: cover;
		width: 100%;
		height: 200px;
		border-radius: 0.5rem 0.5rem 0 0;
	}

	@media screen and (max-width: 600px) {
		section + section {
			margin-top: 0;
		}

		.banner img,
		.banner .blank {
			border-radius: 0;
		}
	}

	.user-info {
		margin-top: calc(100px + 1rem);
	}

	.profile img,
	.profile .blank {
		width: 128px;
		height: 128px;
		border: 4px solid var(--surface);
		border-radius: 50%;
		margin-right: 12px;
		object-fit: cover;
		position: relative;
		z-index: 2;
	}

	.profile img {
		background-color: var(--surface);
	}

	.blank {
		width: 100%;
		height: 100%;
		background-color: var(--accent-surface-high);
	}

	h2 {
		font-weight: 400;
	}

	.user-name-wrapper {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.user-name-wrapper p {
		padding: 0.3rem;
		background-color: var(--accent-surface);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--accent);
		border-radius: 0.25rem;
		line-height: 1;
	}

	.actions .buttons {
		display: flex;
		align-items: center;
		justify-content: start;
		gap: 1rem;
	}

	.profile .actions {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
	}

	.profile .actions div {
		align-self: flex-end;
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

	.relationships {
		display: flex;
		gap: 2rem;
		font-size: 0.95rem;
	}
</style>
