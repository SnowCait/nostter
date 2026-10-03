<script lang="ts">
	import type { Event } from 'nostr-tools/core';
	import { _ } from 'svelte-i18n';
	import { auth } from '$lib/auth.svelte';
	import { metadataStore } from '$lib/cache/Events';
	import { alternativeName } from '$lib/Items';
	import { includesFollow } from '$lib/nostr/protocol/nip02';
	import EmojifiedContent from '$lib/components/EmojifiedContent.svelte';
	import FollowButton from '$lib/components/FollowButton.svelte';
	import NostrAddress from '$lib/components/NostrAddress.svelte';
	import ProfileIcon from '$lib/components/profile/ProfileIcon.svelte';
	import ProfileName from '$lib/components/profile/ProfileName.svelte';
	import { observeFollowList } from '$lib/features/follow-list/application/observe-follow-list';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	let metadata = $derived($metadataStore.get(pubkey));
	let canFollow = $derived(auth.signer !== undefined && auth.pubkey !== pubkey);
	let observesFollowList = $derived(auth.pubkey !== undefined && auth.pubkey !== pubkey);
	let followList = $state<Event>();
	let followsAccount = $derived(
		followList !== undefined &&
			auth.pubkey !== undefined &&
			includesFollow(followList.tags, auth.pubkey)
	);

	$effect(() => {
		followList = undefined;
		if (!observesFollowList) {
			return;
		}

		const subscription = observeFollowList(pubkey).subscribe({
			next: (event) => {
				followList = event;
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
	<div class="name-line">
		<span class="name">
			<span>@</span>
			{#if metadata !== undefined}
				<EmojifiedContent content={metadata.name} tags={metadata.event.tags} />
			{:else}
				<span>{alternativeName(pubkey)}</span>
			{/if}
		</span>
		{#if followsAccount}
			<span class="follows-account">{$_('follow.follows_you')}</span>
		{/if}
	</div>
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
