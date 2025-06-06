<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { createRxOneshotReq, latest, uniq } from 'rx-nostr';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { filterTags } from '$lib/EventHelper';
	import { rxNostr, tie } from '$lib/timelines/MainTimeline';
	import { newUrl } from '$lib/Helper';
	import { type Metadata, alternativeName } from '$lib/Items';
	import { pubkey as authorPubkey, rom } from '$lib/stores/Author';
	import { developerMode } from '$lib/stores/Preference';
	import ZapButton from '$lib/components/ZapButton.svelte';
	import Nip21QrcodeButton from '$lib/components/Nip21QrcodeButton.svelte';
	import Badges from '$lib/components/Badges.svelte';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import FollowButton from '$lib/components/FollowButton.svelte';
	import NostrAddress from '$lib/components/NostrAddress.svelte';
	import UserStatus from '$lib/components/UserStatus.svelte';
	import ReplaceableEventsJson from '$lib/components/ReplaceableEventsJson.svelte';
	import Content from '$lib/components/Content.svelte';
	import IconLink from '@tabler/icons-svelte/icons/link';
	import ProfileMenuButton from '$lib/components/ProfileMenuButton.svelte';
	import ProfileIcon from '$lib/components/profile/ProfileIcon.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';

	export let slug: string;
	export let pubkey: string;
	export let metadata: Metadata | undefined;
	export let relays: string[];

	let p: string | undefined;
	let followees: string[] | undefined;

	$: user = metadata?.content;
	$: url = user?.website ? newUrl(user.website) : undefined;

	$: if (p !== pubkey && browser) {
		console.debug('[npub profile]', nip19.npubEncode(pubkey), relays);

		p = pubkey;
		followees = undefined;

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
			.pipe(tie, uniq(), latest())
			.subscribe({
				next: (packet) => {
					console.debug('[rx-nostr npub contacts]', packet);
					followees = [...new Set(filterTags('p', packet.event.tags))];
				},
				complete: () => {
					console.debug('[rx-nostr npub contacts complete]', followees);
					if (followees === undefined) {
						followees = [];
					}
				},
				error: (error) => {
					console.error('[rx-nostr npub contacts error]', error);
				}
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
			<div class="picture">
				<ProfileIcon {pubkey} />
			</div>
			<div class="buttons">
				<div>
					<ShareButton {pubkey} />
				</div>
				{#if !$rom && pubkey !== undefined}
					<div class="zap">
						<ZapButton {pubkey} />
					</div>
					<div>
						<ProfileMenuButton {pubkey} />
					</div>
					{#if pubkey === $authorPubkey}
						<button on:click={async () => await goto('/profile')}>
							{$_('pages.profile_edit')}
						</button>
					{:else}
						<FollowButton {pubkey} />
					{/if}
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
				<IconLink size="1rem" />
				{#if url}
					<ExternalLink link={url} />
				{:else}
					<span>{user.website}</span>
				{/if}
			</div>
		{/if}
		{#if user?.about}
			<div class="about">
				<Content content={user.about} tags={metadata?.event.tags ?? []} />
			</div>
		{/if}
	</div>
	<Badges {pubkey} {relays} />
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
	<nav>
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
			<a href="/{slug}/lists">{$_('lists.title')}</a>
		</div>
	</nav>

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

	.picture {
		min-width: 128px;
		width: 128px;
		height: 128px;
		object-fit: cover;

		border: 4px solid var(--surface);
		border-radius: 50%;
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
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 1rem;
	}

	.actions .buttons div {
		background-color: var(--surface);
		border: 1px solid var(--accent-surface);
		border-radius: 50%;
		width: 36px;
		height: 36px;
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
		max-height: 20rem;
		overflow-y: auto;
	}

	.relationships {
		display: flex;
		gap: 2rem;
		font-size: 0.95rem;
		margin: 1rem 0;
	}

	nav div {
		margin: 1rem 0;
	}
</style>
