<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Kind, nip19 } from 'nostr-tools';
	import type { EventItem, Item } from '$lib/Items';
	import { metadataStore } from '$lib/cache/Events';
	import IconMessages from '@tabler/icons-svelte/icons/messages';
	import { readRelays } from '$lib/stores/Author';
	import { pool } from '$lib/stores/Pool';
	import { rom } from '$lib/stores/Author';
	import { Api } from '$lib/Api';
	import { onMount } from 'svelte';
	import Content from '$lib/components/Content.svelte';
	import { isReply } from '$lib/EventHelper';
	import { Channel, channelIdStore } from '$lib/Channel';
	import EventMetadata from '$lib/components/EventMetadata.svelte';
	import ProxyLink from '../ProxyLink.svelte';
	import Nip94 from '$lib/components/Nip94.svelte';
	import Via from '../Via.svelte';
	import CreatedAt from '../CreatedAt.svelte';
	import ActionMenu from '../actions/ActionMenu.svelte';

	export let item: Item;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';
	export let full = false;

	$: eventItem = item as EventItem;

	if ($rom) {
		readonly = true;
	}

	let channelId: string | undefined;
	let channelName: string | undefined;

	let contentWarningTag = item.event.tags.find(([tagName]) => tagName === 'content-warning');
	let showContent = contentWarningTag === undefined;
	const showWarningContent = () => {
		showContent = true;
	};

	//#region Fold

	let height: number | undefined;
	let fold = false;
	let first = true;

	$: folded = !full && fold;

	$: if (height !== undefined && height > 500 && first) {
		fold = true;
		first = false;
	}

	//#endregion

	onMount(async () => {
		if (item.event.kind === Kind.ChannelMessage) {
			channelId = item.event.tags
				.find(([tagName, , , marker]) => tagName === 'e' && marker === 'root')
				?.at(1);
			if (channelId === undefined) {
				return;
			}
			const api = new Api($pool, $readRelays);
			const channelMetadataEvent = await api.fetchChannelMetadataEvent(channelId);
			if (channelMetadataEvent === undefined) {
				return;
			}
			channelName = Channel.parseMetadata(channelMetadataEvent)?.name;
		}
	});
</script>

<EventMetadata {item} {createdAtFormat}>
	<section slot="content">
		{#if isReply(item.event)}
			<div class="reply">
				<span>To</span>
				<span>
					@{eventItem.replyToPubkeys
						.slice(0, full ? Infinity : 10)
						.map((pubkey) => {
							const metadata = $metadataStore.get(pubkey);
							const name = metadata?.content?.name;
							if (name !== undefined && name !== '') {
								return name;
							}
							const displayName = metadata?.content?.display_name;
							if (displayName !== undefined && displayName !== '') {
								return displayName;
							}

							try {
								return nip19.npubEncode(pubkey).substring(0, 'npub1'.length + 7);
							} catch (error) {
								console.error('[npub encode error]', pubkey, error);
								return '-';
							}
						})
						.join(' @')}
				</span>
				{#if !full && eventItem.replyToPubkeys.length > 10}
					<span>...</span>
				{/if}
			</div>
		{/if}
		{#if !showContent}
			<div class="content-warning">
				<div>{contentWarningTag?.at(1) ?? ''}</div>
				<button on:click={showWarningContent}>Show</button>
			</div>
		{:else}
			<div class="content" class:folded bind:clientHeight={height}>
				{#if Number(item.event.kind) === 1063}
					<Nip94 event={item.event} />
				{:else}
					<Content content={item.event.content} tags={item.event.tags} />
				{/if}
				{#if folded}
					<button class="open" on:click={() => (fold = false)}>
						<span>{$_('fold.view')}</span>
					</button>
				{/if}
			</div>
		{/if}
		{#if item.event.kind === Kind.ChannelMessage && channelId !== undefined && $channelIdStore === undefined}
			<div class="channel">
				<IconMessages size={16} color={'gray'} />
				<span>
					<a href="/channels/{nip19.neventEncode({ id: channelId })}">
						{channelName ?? 'Channel'}
					</a>
				</span>
			</div>
		{/if}
		{#each item.event.tags.filter(([tagName]) => tagName === 'proxy') as tag}
			<div class="proxy"><ProxyLink {tag} /></div>
		{/each}
		{#if !readonly}
			<ActionMenu item={eventItem} />
		{/if}
		{#if full}
			<footer>
				<CreatedAt createdAt={item.event.created_at} format="full" />
				<Via tags={item.event.tags} />
			</footer>
		{/if}
	</section>
</EventMetadata>

<style>
	.reply {
		font-size: 0.8em;
		color: gray;
	}

	.content {
		margin: 0.2rem 0 0 0;
	}

	.folded {
		max-height: 500px;
		overflow: hidden;
	}

	.open {
		position: absolute;
		bottom: 0;

		width: 100%;
		height: 2rem;
		padding: 0;
		border-radius: 0;
		background: linear-gradient(transparent, var(--surface));
	}

	.open span {
		display: inline-block;
		color: var(--accent);
		background-color: var(--accent-surface-high);
		padding: 0.3rem 1.5rem;
		border-radius: calc(infinity * 1px);
	}

	.open:hover {
		opacity: 1;
	}

	.open:hover span {
		background-color: var(--accent-surface);
	}

	.channel,
	.proxy {
		margin-top: 0.4rem;
	}

	.content-warning {
		padding: 0.5em;
		width: 100%;
		height: 5em;
		background-color: lightgray;
	}

	footer {
		margin-top: 0.2rem;
	}
</style>
