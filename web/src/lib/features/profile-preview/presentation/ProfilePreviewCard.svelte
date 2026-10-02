<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { auth } from '$lib/auth.svelte';
	import { metadataStore } from '$lib/cache/Events';
	import EmojifiedContent from '$lib/components/EmojifiedContent.svelte';
	import FollowButton from '$lib/components/FollowButton.svelte';
	import NostrAddress from '$lib/components/NostrAddress.svelte';
	import ProfileIcon from '$lib/components/profile/ProfileIcon.svelte';
	import ProfileName from '$lib/components/profile/ProfileName.svelte';
	import { isFollowing, observeFollowList } from '../application/follow-list';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	let metadata = $derived($metadataStore.get(pubkey));
	let canFollow = $derived(auth.signer !== undefined && auth.pubkey !== pubkey);
	let followsAccount = $state(false);

	$effect(() => {
		const accountPubkey = auth.pubkey;
		followsAccount = false;
		if (accountPubkey === undefined || accountPubkey === pubkey) {
			return;
		}

		const subscription = observeFollowList(pubkey).subscribe({
			next: (event) => {
				followsAccount = isFollowing(event, accountPubkey);
			},
			error: (error) => {
				console.error('[profile preview follow list error]', error);
			}
		});
		return () => {
			subscription.unsubscribe();
		};
	});
</script>

<div class="profile-preview-card">
	<div class="header">
		<div class="picture">
			<ProfileIcon {pubkey} tooltip={false} />
		</div>
		{#if canFollow}
			<FollowButton {pubkey} />
		{/if}
	</div>
	<div class="display-name">
		<ProfileName {pubkey} displayNameOnly />
	</div>
	{#if (metadata !== undefined && metadata.displayName !== metadata.name) || followsAccount}
		<div class="name-line">
			{#if metadata !== undefined && metadata.displayName !== metadata.name}
				<span class="name">
					<span>@</span>
					<EmojifiedContent content={metadata.name} tags={metadata.event.tags} />
				</span>
			{/if}
			{#if followsAccount}
				<span class="follows-account">{$_('follow.follows_you')}</span>
			{/if}
		</div>
	{/if}
	{#if metadata !== undefined}
		<div class="nip05">
			<NostrAddress {metadata} />
		</div>
		{#if metadata.about}
			<p class="about">
				<EmojifiedContent content={metadata.about} tags={metadata.event.tags} />
			</p>
		{/if}
	{/if}
</div>

<style>
	.profile-preview-card {
		width: min(20rem, calc(100vw - 1rem));
		padding: 1rem;
		border: var(--default-border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		background-color: var(--surface);
		color: var(--surface-foreground);
		font-size: 0.9375rem;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}

	.header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.picture {
		width: 56px;
		height: 56px;
		flex: none;
	}

	.display-name {
		font-size: 1.0625rem;
		font-weight: 700;
	}

	.name-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.name {
		display: flex;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		color: var(--accent-gray);
	}

	.follows-account {
		flex: none;
		padding: 0 0.375rem;
		border-radius: 0.25rem;
		background-color: var(--accent-surface);
		color: var(--accent-gray);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.nip05 {
		color: var(--accent-gray);
		font-size: 0.875rem;
	}

	.nip05 :global(svg) {
		width: 1rem;
		height: 1rem;
	}

	.about {
		margin-top: 0.5rem;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
		white-space: pre-wrap;
	}
</style>
