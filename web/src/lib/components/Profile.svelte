<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { createRxOneshotReq, latest, uniq } from 'rx-nostr';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { filterTags } from '$lib/EventHelper';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { BadgeApi, type Badge } from '$lib/BadgeApi';
	import { robohash, type Metadata, alternativeName } from '$lib/Items';
	import { pubkey as authorPubkey, rom } from '../../stores/Author';
	import { developerMode } from '../../stores/Preference';
	import ZapButton from '$lib/components/ZapButton.svelte';
	import Nip21QrcodeButton from '$lib/components/Nip21QrcodeButton.svelte';
	import Badges from './Badges.svelte';
	import FollowButton from './FollowButton.svelte';
	import MuteButton from './MuteButton.svelte';
	import NostrAddress from './NostrAddress.svelte';
	import UserStatus from './UserStatus.svelte';
	import ReplaceableEventsJson from './ReplaceableEventsJson.svelte';
	import Content from '../../routes/(app)/content/Content.svelte';
	import IconTool from '@tabler/icons-svelte/dist/svelte/icons/IconTool.svelte';

	export let slug: string;
	export let pubkey: string;
	export let metadata: Metadata | undefined;
	export let relays: string[] = [];

	let p: string | undefined;
	let followees: string[] | undefined;

	let badges: Badge[] = []; // NIP-58 Badges

	$: user = metadata?.content;

	$: if (p !== pubkey && browser) {
		console.log('[npub profile]', nip19.npubEncode(pubkey), relays);

		p = pubkey;
		followees = undefined;
		badges = [];

		const contactsReq = createRxOneshotReq({
			filters: [
				{
					kinds: [3],
					authors: [pubkey],
					limit: 1
				}
			]
		});
		rxNostr
			.use(contactsReq)
			.pipe(uniq(), latest())
			.subscribe({
				next: (packet) => {
					console.log('[rx-nostr npub contacts]', packet);
					followees = [...new Set(filterTags('p', packet.event.tags))];
				},
				complete: () => {
					console.log('[rx-nostr npub contacts complete]', followees);
					if (followees === undefined) {
						followees = [];
					}
				},
				error: (error) => {
					console.error('[rx-nostr npub contacts error]', error);
				}
			});

		const badgeApi = new BadgeApi();
		badgeApi.fetchBadges(relays, pubkey).then((data) => {
			badges = data;
		});
	}
</script>

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
				<img src={metadata?.picture ?? robohash(pubkey)} alt="" />
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
					<div class="mute">
						<ZapButton {pubkey} />
					</div>
					<FollowButton {pubkey} />
				{/if}
			</div>
		</div>
		<h1>{metadata?.displayName ?? alternativeName(pubkey)}</h1>
		<div class="user-name-wrapper">
			<h2>@{metadata?.name ?? alternativeName(pubkey)}</h2>
			{#if followees?.some((pubkey) => pubkey === $authorPubkey)}
				<p>Follows you</p>
			{/if}
			{#if pubkey !== undefined}
				<Nip21QrcodeButton identifier={nip19.npubEncode(pubkey)} />
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
			{$_('pages.followees')}: {#if followees === undefined}
				<span>-</span>
			{:else}
				<a href={`/${slug}/followees`}>{followees.length}</a>
			{/if}
		</div>
		<div>
			{$_('pages.followers')}: <a href={`/${slug}/followers`}>{$_('pages.followers_see')}</a>
		</div>
	</div>
	<div>
		<a href="/{slug}/relays">{$_('pages.relays')}</a>
	</div>
	<div>
		<a href="/{slug}/media">{$_('pages.media')}</a>
	</div>
	<div>
		<a href="/{slug}/timeline">{$_('pages.timeline')}</a>
	</div>
	<div>
		<a href="/{slug}/pins">{$_('pages.pinned')}</a>
	</div>
	<div>
		<a href="/{slug}/reactions">{$_('pages.reactions')}</a>
	</div>
	<div>
		<a href="https://rss.nostter.app/{nip19.npubEncode(pubkey)}">RSS</a>
	</div>

	{#if $developerMode}
		<ReplaceableEventsJson />
	{/if}
</div>

<style>
	.banner {
		width: calc(100% + 2rem);
		height: 200px;
		margin: -1rem;
	}

	.banner img,
	.banner .blank {
		object-fit: cover;
		width: 100%;
		height: 200px;
		border-radius: 0.5rem 0.5rem 0 0;
	}

	@media screen and (max-width: 600px) {
		.banner img,
		.banner .blank {
			border-radius: 0;
		}
	}

	.user-info {
		margin-top: calc(-100px + 2rem);
	}

	.profile img {
		width: 128px;
		height: 128px;
		border: 4px solid var(--surface);
		border-radius: 50%;
		margin-right: 12px;
		object-fit: cover;
		position: relative;
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
