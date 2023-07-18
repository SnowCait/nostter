<script lang="ts">
	import { error } from '@sveltejs/kit';
	import { page } from '$app/stores';
	import { nip19, SimplePool } from 'nostr-tools';
	import type { Event, User } from '../types';
	import { pool } from '../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';
	import { pubkey as authorPubkey, readRelays, rom } from '../../stores/Author';
	import { afterNavigate } from '$app/navigation';
	import Follow from '../action/Follow.svelte';
	import { Api } from '$lib/Api';
	import { BadgeApi, type Badge } from '$lib/BadgeApi';
	import Loading from '../Loading.svelte';
	import { User as UserDecoder } from '$lib/User';
	import { Timeline } from '$lib/Timeline';
	import Badges from '../Badges.svelte';
	import Content from '../content/Content.svelte';
	import { Metadata } from '$lib/Items';
	import { minTimelineLength } from '$lib/Constants';
	import IconTool from '@tabler/icons-svelte/dist/svelte/icons/IconTool.svelte';

	let metadata: Metadata;
	let user: User | undefined;
	let badges: Badge[] = []; // NIP-58 Badges
	let events: Event[] = [];
	let pubkey = '';
	let followees: string[] = [];
	let followers: string[] = [];
	let followeesLoading = true;
	let followersLoading = true;
	let timeline: Timeline;

	let relays = $readRelays;
	let slug = $page.params.npub;
	const api = new Api($pool, relays);

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
				zapEndpoint: metadata.zapUrl?.href ?? null
			} as User;
		}

		if (user !== undefined && user.nip05 && slug !== user.nip05) {
			history.replaceState(history.state, '', user.nip05);
			slug = user.nip05;
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

		let firstLength = events.length;
		let count = 0;
		let until = events.at(events.length - 1)?.created_at ?? Math.floor(Date.now() / 1000);
		let seconds = 12 * 60 * 60;

		while (events.length - firstLength < minTimelineLength && count < 10) {
			const pastEventItems = await timeline.fetch(until, seconds);
			events.push(
				...pastEventItems.map((x) => {
					return {
						...x.event,
						user: x.metadata?.content
					} as Event;
				})
			);
			events = events;

			until -= seconds;
			seconds *= 2;
			count++;
			console.log('[load]', count, until, seconds / 3600, events.length);
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
					<div class="profile">
						<a href="/profile">
							<IconTool />
						</a>
					</div>
				{/if}
				<div class="follow">
					<Follow {pubkey} />
				</div>
			{/if}
		</div>
		<h1>{user?.display_name ?? user?.name ?? ''}</h1>
		{#if user?.name}
			<h2>@{user.name}</h2>
		{/if}
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
</section>

<section>
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
	{#if pubkey === $authorPubkey}
		<div>
			<a href="/{slug}/reactions">Reactions</a>
		</div>
	{/if}
	<TimelineView {events} readonly={!$authorPubkey} {load} />
</section>

<style>
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

	.profile .actions .profile {
		margin-left: auto;
		margin-right: 1em;
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

	.nip19 {
		overflow: auto;
	}
</style>
