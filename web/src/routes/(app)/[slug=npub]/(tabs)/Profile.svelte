<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { createRxOneshotReq, latest, uniq } from 'rx-nostr';
	import { _ } from 'svelte-i18n';
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
	import UserStatusEditor from '$lib/components/UserStatusFull.svelte';
	import ReplaceableEventsJson from '$lib/components/ReplaceableEventsJson.svelte';
	import Content from '$lib/components/Content.svelte';
	import IconLink from '@tabler/icons-svelte-runes/icons/link';
	import ProfileMenuButton from '$lib/components/ProfileMenuButton.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import EmojifiedContent from '$lib/components/EmojifiedContent.svelte';
	import { userStatusReqEmit } from '$lib/UserStatus';
	import { untrack } from 'svelte';
	import { fold } from '$lib/components/shared/ViewMoreAttachment.svelte';
	import ProfileIconThumbnail from '$lib/components/profile/ProfileIconThumbnail.svelte';

	interface Props {
		slug: string;
		pubkey: string;
		metadata: Metadata | undefined;
		relays: string[];
	}

	let { slug, pubkey, metadata, relays }: Props = $props();

	let p: string | undefined;
	let followees: string[] | undefined = $state();

	let user = $derived(metadata?.content);
	let url = $derived(user?.website ? newUrl(user.website) : undefined);

	$effect(() => {
		if (p === pubkey) {
			return;
		}

		console.debug('[npub profile]', nip19.npubEncode(pubkey), relays);

		untrack(() => {
			p = pubkey;
			followees = undefined;
		});

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
					console.debug('[npub contacts]', packet);
					followees = [...new Set(filterTags('p', packet.event.tags))];
				},
				complete: () => {
					console.debug('[npub contacts complete]', $state.snapshot(followees));
					if (followees === undefined) {
						followees = [];
					}
				},
				error: (error) => {
					console.error('[npub contacts error]', error);
				}
			});

		userStatusReqEmit([pubkey]);
	});
</script>

<div class="banner">
	{#if user?.banner}
		<img src={user.banner} alt="" />
	{:else}
		<div class="blank"></div>
	{/if}
</div>
<div class="user-info">
	<div class="profile">
		<div class="actions">
			<div class="picture">
				<ProfileIconThumbnail {pubkey} />
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
						<a href="/profile" class="rounded-button">{$_('pages.profile_edit')}</a>
					{:else}
						<FollowButton {pubkey} />
					{/if}
				{/if}
			</div>
		</div>
		<h1>
			{#if metadata !== undefined}
				<EmojifiedContent content={metadata.displayName} tags={metadata.event.tags} />
			{:else}
				{alternativeName(pubkey)}
			{/if}
		</h1>
		<div class="user-name-wrapper">
			<h2>
				<span>@</span>
				{#if metadata !== undefined}
					<EmojifiedContent content={metadata.name} tags={metadata.event.tags} />
				{:else}
					<span>{alternativeName(pubkey)}</span>
				{/if}
			</h2>
			{#if followees?.some((pubkey) => pubkey === $authorPubkey)}
				<p class="label">Follows you</p>
			{/if}
			{#if pubkey !== undefined}
				<Nip21QrcodeButton identifier={nip19.npubEncode(pubkey)} />
			{/if}
		</div>

		{#if metadata !== undefined}
			<NostrAddress {metadata} />
		{/if}

		{#if user?.about}
			<div class="about" {@attach fold()}>
				<Content content={user.about} tags={metadata?.event.tags ?? []} />
			</div>
		{/if}

		{#if user?.website}
			<div class="website">
				<IconLink size="18" />
				{#if url}
					<ExternalLink link={url} />
				{:else}
					<span>{user.website}</span>
				{/if}
			</div>
		{/if}
	</div>
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

	{#if pubkey !== undefined}
		<UserStatusEditor {pubkey} />
	{/if}

	<Badges {pubkey} {relays} />

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
		height: 100%;
		border-radius: 0.5rem 0.5rem 0 0;
	}

	@media screen and (max-width: 600px) {
		.banner {
			height: 100px;
		}

		.banner img,
		.banner .blank {
			border-radius: 0;
		}
	}

	.user-info {
		margin-top: calc(-100px + 2rem);
	}

	.picture {
		--picture-size: 128px;
		min-width: var(--picture-size);
		width: var(--picture-size);
		height: var(--picture-size);
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

	h1,
	h2 {
		display: flex;
	}

	.user-name-wrapper {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.actions .buttons {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 1rem;

		margin-bottom: 16px;
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
		background-color: var(--surface);
	}

	.website {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.relationships {
		display: flex;
		gap: 2rem;
		font-size: 0.95rem;
		margin: 1rem 0;
	}
</style>
