<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { createRxOneshotReq, latest, uniq } from 'rx-nostr';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { filterTags } from '$lib/EventHelper';
	import TimelineView from '../../TimelineView.svelte';
	import { author, pubkey as authorPubkey } from '$lib/stores/Author';
	import { appName } from '$lib/Constants';
	import type { Metadata } from '$lib/Items';
	import type { LayoutData } from '../$types';
	import { metadataReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import { metadataStore } from '$lib/cache/Events';
	import { lastNoteReqEmit } from '$lib/LastNotes';
	import type { pubkey as Pubkey } from '$lib/Types';
	import FollowAllButton from '$lib/components/actions/FollowAllButton.svelte';
	import '@tabler/icons-webfont/dist/tabler-icons.min.css';

	export let data: LayoutData;

	let pubkey: string | undefined;
	let pubkeys: Pubkey[] = [];

	$: items = pubkeys
		.map((pubkey) => $metadataStore.get(pubkey))
		.filter((metadata): metadata is Metadata => metadata !== undefined);

	$: if (pubkey !== data.pubkey && browser) {
		console.log('[followees page]', nip19.npubEncode(data.pubkey));
		pubkey = data.pubkey;

		const contactsReq = createRxOneshotReq({
			filters: [
				{
					kinds: [3],
					authors: [data.pubkey],
					limit: 1
				}
			]
		});
		rxNostr
			.use(contactsReq)
			.pipe(tie, uniq(), latest())
			.subscribe((packet) => {
				console.log('[rx-nostr contacts]', packet);
				pubkeys = [...new Set(filterTags('p', packet.event.tags).reverse())];
				metadataReqEmit(pubkeys);
				if ($author === undefined) {
					return;
				}
				lastNoteReqEmit(pubkeys);
			});
	}
</script>

<svelte:head>
	<title>{appName} - {$_('pages.followees')}</title>
</svelte:head>

<div>
	<h1>{$_('pages.followees')} ({pubkeys.length})</h1>
	{#if pubkey === $authorPubkey}
		<button
			on:click={() =>
				open('https://tsukemonogit.github.io/NFO/', '_blank', 'noopener,noreferrer')}
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
		font-family: 'tabler-icons';
		content: '\ea99';
	}
</style>
