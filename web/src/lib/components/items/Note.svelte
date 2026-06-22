<script lang="ts">
	import { kinds as Kind, nip19 } from 'nostr-tools';
	import type { EventItem, Item } from '$lib/Items';
	import { eventItemStore, metadataStore } from '$lib/cache/Events';
	import IconMessages from '@tabler/icons-svelte-runes/icons/messages';
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
	import OnelineNote from './OnelineNote.svelte';
	import { inThread } from '$lib/Thread';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import Foldable from '$lib/components/shared/Foldable.svelte';
	import { _ } from 'svelte-i18n';
	import SeenOnRelayIcons from '../SeenOnRelayIcons.svelte';
	import { seenOnRelayIcon } from '$lib/SeenOnRelayIcon';
	import { showVia } from '$lib/ShowVia';

	interface Props {
		item: Item;
		readonly: boolean;
		createdAtFormat?: 'auto' | 'time';
		full?: boolean;
	}

	let { item, readonly = $bindable(), createdAtFormat = 'auto', full = false }: Props = $props();

	let eventItem = $derived(item as EventItem);

	if ($rom) {
		readonly = true;
	}

	let channelId: string | undefined = $state();
	let channelName: string | undefined = $state();

	let contentWarningTag = $derived(
		item.event.tags.find(([tagName]) => tagName === 'content-warning')
	);
	let showContent = $state(false);
	const showWarningContent = () => {
		showContent = true;
	};

	onMount(async () => {
		if (item.event.kind === Kind.ChannelMessage) {
			channelId = item.event.tags
				.find(([tagName, , , marker]) => tagName === 'e' && marker === 'root')
				?.at(1);
			if (channelId === undefined) {
				return;
			}
			const api = new Api();
			const channelMetadataEvent = await api.fetchChannelMetadataEvent(channelId);
			if (channelMetadataEvent === undefined) {
				return;
			}
			channelName = Channel.parseMetadata(channelMetadataEvent)?.name;
		}
	});
</script>

{#if eventItem.replyToId && !$inThread}
	{@const replyTo = $eventItemStore.get(eventItem.replyToId)}
	{#if replyTo}
		<OnelineNote item={replyTo} />
	{/if}
{/if}

<EventMetadata {item} {createdAtFormat}>
	{#snippet content()}
		<section>
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
									return nip19
										.npubEncode(pubkey)
										.substring(0, 'npub1'.length + 7);
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
			{#if contentWarningTag !== undefined && !showContent}
				<div class="content-warning">
					<div>{contentWarningTag?.at(1) ?? ''}</div>
					<button onclick={showWarningContent}>{$_('content.show')}</button>
				</div>
			{:else}
				<Foldable maxHeightRem={30} enabled={!full}>
					<div class="content">
						{#if Number(item.event.kind) === 1063}
							<Nip94 event={item.event} />
						{:else}
							<Content content={item.event.content} tags={item.event.tags} />
						{/if}
					</div>
				</Foldable>
			{/if}
			{#if item.event.kind === Kind.ChannelMessage && channelId !== undefined && $channelIdStore === undefined}
				<div class="channel">
					<IconMessages size={16} color="gray" />
					<span>
						<a
							href="/channels/{nip19.neventEncode({
								id: channelId,
								relays: getSeenOnRelays(channelId)
							})}"
						>
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
					<div class="relay-info">
						<SeenOnRelayIcons id={item.event.id} />
						<div class="via"><Via tags={item.event.tags} /></div>
					</div>
				</footer>
			{:else if $seenOnRelayIcon || $showVia}
				<footer class="relay-info">
					{#if $seenOnRelayIcon}
						<SeenOnRelayIcons id={item.event.id} />
					{/if}
					{#if $showVia}
						<div class="via"><Via tags={item.event.tags} /></div>
					{/if}
				</footer>
			{/if}
		</section>
	{/snippet}
</EventMetadata>

<style>
	.reply {
		font-size: 0.8em;
		color: gray;
	}

	.content {
		margin: 0.2rem 0 0 0;
		min-width: 0;
	}

	.content :global(blockquote),
	.content :global(iframe) {
		max-width: 100%;
	}

	.content :global(iframe) {
		display: block;
	}

	.channel,
	.proxy {
		margin-top: 0.4rem;
	}

	.channel {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.content-warning {
		padding: 0.5em;
		width: 100%;
		min-height: 5em;
		color: black;
		background-color: lightgray;
	}

	footer {
		margin-top: 0.2rem;
	}

	.relay-info {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 0.5rem;
	}

	footer.relay-info {
		margin-top: 0.5rem;
	}

	.relay-info .via {
		margin-left: auto;
	}
</style>
