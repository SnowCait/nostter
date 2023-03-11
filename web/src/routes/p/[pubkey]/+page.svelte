<script lang="ts">
	import { onMount } from 'svelte';
	import { error } from '@sveltejs/kit';
	import { page } from '$app/stores';
	import { nip19 } from 'nostr-tools';
	import type { Event, User, UserEvent } from '../../types';
	import { userEvents } from '../../../stores/UserEvents';
	import { pool } from '../../../stores/Pool';
	import { defaultRelays } from '../../../stores/DefaultRelays';

	const pubkey = $page.params.pubkey;
	let user: User | undefined;
	let badges: Badge[] = []; // NIP-58 Badges

	// TODO: Replace to user relays
	const relays = $defaultRelays;

	onMount(async () => {
		console.log('onMount');

		user = $userEvents.get(pubkey)?.user;
		console.log('[cached user]', user);
		if (user === undefined) {
			user = await fetchUser(relays, pubkey);
			console.log('[fetched user]', user);
		}
		if (user === undefined) {
			throw error(404);
		}

		badges = await fetchBadges(relays, pubkey);
	});

	async function fetchUser(relays: string[], pubkey: string): Promise<User | undefined> {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(undefined);
			}, 3000);

			let userEvent: UserEvent;

			const subscribeProfile = $pool.sub(Array.from(relays), [
				{
					kinds: [0],
					authors: [pubkey]
				}
			]);
			subscribeProfile.on('event', (event: Event) => {
				console.log(event);

				if (userEvent === undefined || userEvent.created_at < event.created_at) {
					userEvent = event;
				}
			});
			subscribeProfile.on('eose', () => {
				subscribeProfile.unsub();

				if (userEvent !== undefined) {
					const user = JSON.parse(userEvent.content) as User;
					resolve(user);
				} else {
					resolve(undefined);
				}
			});
		});
	}

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
			subscribeProfileBadges.on('event', (event: Event) => {
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
				subscribeBadgeDefinitions.on('event', (event: Event) => {
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
			<img src={user.picture} alt="" />
			<h1>{user.display_name ?? user.name ?? ''}</h1>
			{#if user.name}
				<h2>@{user.name}</h2>
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
</style>
