<script lang="ts">
	import { newUrl } from '$lib/Helper';
	import type { EventItem, Item } from '$lib/Items';
	import { fetchLastEvent } from '$lib/RxNostrHelper';
	import {
		parsePodcastEpisode,
		parsePodcastMetadata,
		podcastMetadataKind,
		type PodcastMetadata
	} from '$lib/nostr/protocol/nipf4';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { isAudioResourceUrl, isHttpUrl, isImageResourceUrl } from '$lib/url';
	import ActionMenu from '../actions/ActionMenu.svelte';
	import Content from '../Content.svelte';
	import EventMetadata from '../EventMetadata.svelte';
	import ExternalLink from '../ExternalLink.svelte';

	interface Props {
		item: Item;
		readonly: boolean;
		createdAtFormat?: 'auto' | 'time';
	}

	let { item, readonly, createdAtFormat = 'auto' }: Props = $props();

	let eventItem = $derived(item as EventItem);
	let episode = $derived(parsePodcastEpisode(item.event));
	let podcastMetadata: PodcastMetadata | undefined = $state();
	let image = $derived.by(() => {
		const episodeImage = episode.image === undefined ? undefined : newUrl(episode.image);
		if (episodeImage !== undefined && isImageResourceUrl(episodeImage)) {
			return episode.image;
		}

		const podcastImage =
			podcastMetadata?.image === undefined ? undefined : newUrl(podcastMetadata.image);
		return podcastImage !== undefined && isImageResourceUrl(podcastImage)
			? podcastMetadata?.image
			: undefined;
	});
	let audioSources = $derived(
		episode.audio.filter((audio) => {
			const url = newUrl(audio.url);
			return url !== undefined && isAudioResourceUrl(url);
		})
	);
	let websites = $derived(
		(podcastMetadata?.websites ?? []).flatMap((website) => {
			const url = newUrl(website);
			return url !== undefined && isHttpUrl(url) ? [url] : [];
		})
	);

	$effect(() => {
		const pubkey = item.event.pubkey;
		const relays = getSeenOnRelays(item.event.id);
		let active = true;

		podcastMetadata = undefined;
		void fetchLastEvent(
			{ kinds: [podcastMetadataKind], authors: [pubkey], limit: 1 },
			{ defaultReadRelays: true, relays }
		).then((event) => {
			if (active) {
				podcastMetadata = event === undefined ? undefined : parsePodcastMetadata(event);
			}
		});

		return () => {
			active = false;
		};
	});
</script>

<EventMetadata {item} {createdAtFormat}>
	{#snippet content()}
		<section class="podcast-episode">
			{#if image !== undefined}
				<img
					src={image}
					alt={episode.title ?? podcastMetadata?.title ?? ''}
					loading="lazy"
				/>
			{/if}
			{#if episode.title !== undefined}
				<h2>{episode.title}</h2>
			{/if}
			{#if podcastMetadata?.title !== undefined || podcastMetadata?.description !== undefined || websites.length > 0}
				<aside class="podcast">
					{#if podcastMetadata?.title !== undefined}
						<h3>{podcastMetadata.title}</h3>
					{/if}
					{#if podcastMetadata?.description !== undefined}
						<p>{podcastMetadata.description}</p>
					{/if}
					{#if websites.length > 0}
						<div class="websites">
							{#each websites as website}
								<ExternalLink link={website} />
							{/each}
						</div>
					{/if}
				</aside>
			{/if}
			{#if episode.description !== undefined}
				<p class="description">{episode.description}</p>
			{/if}
			{#each audioSources as audio}
				<audio controls preload="metadata">
					<source src={audio.url} type={audio.mediaType} />
				</audio>
			{/each}
			{#if episode.content !== ''}
				<Content content={episode.content} tags={item.event.tags} />
			{/if}
			{#if !readonly}
				<ActionMenu item={eventItem} />
			{/if}
		</section>
	{/snippet}
</EventMetadata>

<style>
	.podcast-episode,
	.podcast {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.podcast {
		padding-left: 0.75rem;
		border-left: 3px solid var(--accent);
	}

	h2,
	h3,
	p {
		margin: 0;
	}

	img {
		max-width: 100%;
		max-height: 30rem;
		object-fit: contain;
	}

	audio {
		width: 100%;
	}

	.description,
	.podcast p {
		white-space: pre-line;
		word-break: break-word;
	}

	.websites {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
</style>
