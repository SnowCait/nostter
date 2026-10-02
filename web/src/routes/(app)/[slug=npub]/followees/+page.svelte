<script lang="ts">
	import { kinds as Kind, nip19 } from 'nostr-tools';
	import { _ } from 'svelte-i18n';
	import { filterTags } from '$lib/EventHelper';
	import { unique } from '$lib/array';
	import TimelineView from '../../TimelineView.svelte';
	import { auth } from '$lib/auth.svelte';
	import { appName } from '$lib/app';
	import { Metadata } from '$lib/Items';
	import type { LayoutData } from '../$types';
	import { metadataReqEmit } from '$lib/timelines/MainTimeline';
	import { requestLatestReplaceableEvent } from '$lib/nostr/relay/event-operations';
	import { metadataStore } from '$lib/cache/Events';
	import { lastNoteReqEmit } from '$lib/LastNotes';
	import type { pubkey as Pubkey } from '$lib/Types';
	import FollowAllButton from '$lib/components/actions/FollowAllButton.svelte';
	import externalLinkIconUrl from '$lib/assets/icons/external-link.svg?url';

	interface Props {
		data: LayoutData;
	}

	let { data }: Props = $props();

	let pubkeys: Pubkey[] = $state([]);

	let items = $derived(
		pubkeys.map((pubkey) => $metadataStore.get(pubkey) ?? Metadata.placeholder(pubkey))
	);

	$effect(() => {
		const targetPubkey = data.pubkey;

		console.log('[followees page]', nip19.npubEncode(targetPubkey));
		pubkeys = [];

		const subscription = requestLatestReplaceableEvent(Kind.Contacts, targetPubkey).subscribe(
			(event) => {
				console.log('[rx-nostr contacts]', event);
				pubkeys = unique(filterTags('p', event.tags).reverse());
				metadataReqEmit(pubkeys);
				if (!auth.isAuthenticated) {
					return;
				}
				lastNoteReqEmit(pubkeys);
			}
		);

		return () => {
			subscription.unsubscribe();
		};
	});
</script>

<svelte:head>
	<title>{appName} - {$_('pages.followees')}</title>
</svelte:head>

<div>
	<h1>{$_('pages.followees')} ({pubkeys.length})</h1>
	{#if data.pubkey === auth.pubkey}
		<button
			onclick={() =>
				open('https://tsukemonogit.github.io/NFO/', '_blank', 'noopener,noreferrer')}
			style:--external-link-icon={`url("${externalLinkIconUrl}")`}
		>
			{$_('follow.organize')}
		</button>
	{:else}
		<FollowAllButton {pubkeys} />
	{/if}
</div>

<TimelineView {items} showLoading={false} />

<style>
	div {
		display: flex;
		justify-content: space-between;
		margin: 0.5rem auto;
	}

	button::after {
		content: '';
		display: inline-block;
		width: 1em;
		height: 1em;
		vertical-align: -0.125em;
		background-color: currentColor;
		mask: var(--external-link-icon) center / contain no-repeat;
		-webkit-mask: var(--external-link-icon) center / contain no-repeat;
	}
</style>
