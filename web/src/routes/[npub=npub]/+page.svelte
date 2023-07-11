<script lang="ts">
	import { error } from '@sveltejs/kit';
	import { page } from '$app/stores';
	import { nip19, SimplePool, type Event as NostrEvent } from 'nostr-tools';
	import type { Event, User } from '../types';
	import { userEvents } from '../../stores/UserEvents';
	import { pool } from '../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';
	import { pubkey as authorPubkey, isMuteEvent, readRelays, rom } from '../../stores/Author';
	import { afterNavigate } from '$app/navigation';
	import Follow from '../Follow.svelte';
	import { Api } from '$lib/Api';
	import Loading from '../Loading.svelte';
	import { User as UserDecoder } from '$lib/User';

	let user: User | undefined;
	let badges: Badge[] = []; // NIP-58 Badges
	let notes: Event[] = [];
	let pubkey = '';
	let followees: string[] = [];
	let followers: string[] = [];
	let followeesLoading = true;
	let followersLoading = true;

	let relays = $readRelays;
	let slug = $page.params.npub;
	const api = new Api($pool, relays);

	afterNavigate(async () => {
		slug = $page.params.npub;
		console.log('[profile page]', slug);

		badges = [];
		notes = [];

		const data = await UserDecoder.decode(slug);

		if (data.pubkey === undefined) {
			throw error(404);
		}

		pubkey = data.pubkey;
		relays = Array.from(new Set([...relays, ...data.relays]));

		user = (await api.fetchUserEvent(pubkey))?.user;
		if (user === undefined) {
			throw error(404);
		}

		if (user.nip05 && slug !== user.nip05) {
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
		fetchBadges(relays, pubkey).then((data) => {
			badges = data;
		});
		notes = await fetchPastNotes(pubkey);
	});

	async function fetchBadges(relays: string[], pubkey: string): Promise<Badge[]> {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve([]);
			}, 10000);

			let profileBadges: ProfileBadge[] = [];
			const subscribeProfileBadges = $pool.sub(relays, [
				{
					kinds: [30008],
					authors: [pubkey]
				}
			]);
			subscribeProfileBadges.on('event', (event: NostrEvent) => {
				console.log('[profile badges event]', event);
				if (
					event.tags.some(([tagName, id]) => tagName === 'd' && id === 'profile_badges')
				) {
					for (let i = 0; i < event.tags.length; i++) {
						const tag = event.tags[i];
						if (tag[0] === 'd') {
							continue;
						}

						if (tag[0] === 'a') {
							const [kind, pubkey, badgeId] = tag[1].split(':');
							i++;
							const eTag = event.tags[i];
							const [tagName, eventId, relay] = eTag;
							if (tagName === 'e') {
								const badge = {
									kind,
									pubkey,
									badgeId,
									eventId,
									relay
								} as ProfileBadge;
								profileBadges.push(badge);
							}
						}
					}
				}
			});
			subscribeProfileBadges.on('eose', () => {
				console.log('[profile badges]', profileBadges);
				const pubkeys = new Set(profileBadges.map((x) => x.pubkey));
				const subscribeBadgeDefinitions = $pool.sub(relays, [
					{
						kinds: [30009],
						authors: Array.from(pubkeys)
					}
				]);
				subscribeBadgeDefinitions.on('event', (event: NostrEvent) => {
					console.log('[badge definitions event]', event);
					const badge = {} as Badge;
					for (const [tagName, tagContent] of event.tags) {
						switch (tagName) {
							case 'd':
								badge.id = tagContent;
								break;
							case 'name':
								badge.name = tagContent;
								break;
							case 'description':
								badge.description = tagContent;
								break;
							case 'image':
								badge.image = tagContent;
								break;
							case 'thumb':
								badge.thumb = tagContent;
								break;
						}
					}
					console.log('[badge]', badge);
					if (
						profileBadges.some(
							(x) => x.pubkey === event.pubkey && x.badgeId === badge.id
						)
					) {
						badge.naddr = nip19.naddrEncode({
							identifier: badge.id,
							pubkey: event.pubkey,
							kind: 30009
						});
						badges.push(badge);
					}
				});
				subscribeBadgeDefinitions.on('eose', () => {
					console.log('[badges]', badges);
					resolve(badges);
				});
			});
		});
	}

	async function fetchPastNotes(pubkey: string, until?: number | undefined): Promise<Event[]> {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve([]);
			}, 10000);

			let events: Event[] = [];
			const subscribeNotes = $pool.sub(relays, [
				{
					kinds: [1, 6],
					authors: [pubkey],
					limit: 100,
					until
				}
			]);
			subscribeNotes.on('event', (nostrEvent: NostrEvent) => {
				const event = nostrEvent as Event;
				console.debug(event);

				if (isMuteEvent(event)) {
					return;
				}

				const userEvent = $userEvents.get(event.pubkey);
				if (userEvent === undefined) {
					console.error(`${nip19.npubEncode(pubkey)} not found in $userEvents`);
					return;
				}
				event.user = userEvent.user;

				events.push(event);
			});
			subscribeNotes.on('eose', () => {
				subscribeNotes.unsub();
				events.sort((x, y) => y.created_at - x.created_at);
				resolve(events);
			});
		});
	}

	interface Badge {
		id: string;
		name: string;
		description: string;
		image: string;
		thumb: string;
		naddr: string;
	}

	interface ProfileBadge {
		kind: string;
		pubkey: string;
		badgeId: string;
		eventId: string;
		relay: string;
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
	{#if user}
		<div class="banner">
			<img src={user.banner} alt="" />
		</div>
		<div class="profile">
			<div class="actions">
				<div>
					<img src={user.picture} alt="" />
				</div>
				{#if !$rom}
					<div class="follow">
						<Follow {pubkey} />
					</div>
				{/if}
			</div>
			<h1>{user.display_name ?? user.name ?? ''}</h1>
			{#if user.name}
				<h2>@{user.name}</h2>
			{/if}
			<div class="nip19">{nip19.npubEncode(pubkey)}</div>
			<div class="nip19">{nip19.nprofileEncode({ pubkey })}</div>
			{#if followees.some((pubkey) => pubkey === $authorPubkey)}
				<div>Follows you</div>
			{/if}
			{#if user.website}
				<div>
					<a href={user.website} target="_blank" rel="noreferrer">{user.website}</a>
				</div>
			{/if}
			{#if user.about}
				<pre>{user.about}</pre>
			{/if}
		</div>
	{/if}
	<ul class="badges">
		{#each badges as badge}
			<li>
				<a href="https://badges.page/b/{badge.naddr}" target="_blank" rel="noreferrer">
					<img
						src={badge.thumb ? badge.thumb : badge.image}
						alt={badge.name}
						title={badge.name}
					/>
				</a>
			</li>
		{/each}
	</ul>
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
	<TimelineView
		events={notes}
		readonly={!$authorPubkey}
		load={async () => {
			const oldestCreatedAt = notes.at(notes.length - 1)?.created_at;
			const events = await fetchPastNotes(
				pubkey,
				oldestCreatedAt !== undefined ? oldestCreatedAt - 1 : undefined
			);
			notes.push(...events);
			notes = notes;
		}}
	/>
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

	.profile h1 {
		margin: 0;
	}

	.profile h2 {
		margin: 0;
		color: gray;
		font-size: 1em;
	}

	.profile pre {
		line-height: 1.5em;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.badges {
		list-style: none;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
	}

	.badges img {
		width: 50px;
		height: 50px;
		border-radius: 50%;
		object-fit: cover;
	}

	.nip19 {
		overflow: auto;
	}
</style>
