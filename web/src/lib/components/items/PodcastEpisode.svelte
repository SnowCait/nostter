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
			return episodeImage.href;
		}

		const podcastImage =
			podcastMetadata?.image === undefined ? undefined : newUrl(podcastMetadata.image);
		return podcastImage !== undefined && isImageResourceUrl(podcastImage)
			? podcastImage.href
			: undefined;
	});
	let audioSources = $derived(
		episode.audio.flatMap((audio) => {
			const url = newUrl(audio.url);
			return url !== undefined && isAudioResourceUrl(url)
				? [{ ...audio, url: url.href }]
				: [];
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
			{#if image !== undefined || episode.title !== undefined || podcastMetadata?.title !== undefined || websites.length > 0}
				<header class="episode-header">
					{#if image !== undefined}
						<img
							class="cover"
							src={image}
							alt={episode.title ?? podcastMetadata?.title ?? ''}
							loading="lazy"
						/>
					{/if}
					<div class="episode-heading">
						{#if episode.title !== undefined}
							<h2>{episode.title}</h2>
						{/if}
						{#if podcastMetadata?.title !== undefined}
							<p class="podcast-title">{podcastMetadata.title}</p>
						{/if}
						{#if websites.length > 0}
							<div class="websites">
								{#each websites as website}
									<ExternalLink link={website} />
								{/each}
							</div>
						{/if}
					</div>
				</header>
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
	.podcast-episode {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.episode-header {
		display: flex;
		align-items: flex-start;
		gap: 0.875rem;
		min-width: 0;
	}

	.cover {
		width: 7.5rem;
		height: 7.5rem;
		flex: 0 0 7.5rem;
		border-radius: var(--radius);
		object-fit: cover;
	}

	.episode-heading {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
		padding-block: 0.125rem;
	}

	h2,
	p {
		margin: 0;
	}

	h2 {
		font-size: 1.25rem;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.podcast-title {
		color: var(--accent-gray);
		font-size: 0.9rem;
		font-weight: 600;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}

	audio {
		width: 100%;
		min-width: 0;
	}

	.description {
		white-space: pre-line;
		overflow-wrap: anywhere;
	}

	.websites {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.125rem;
		font-size: 0.8rem;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	@media (max-width: 480px) {
		.episode-header {
			gap: 0.75rem;
		}

		.cover {
			width: 5.75rem;
			height: 5.75rem;
			flex-basis: 5.75rem;
		}

		h2 {
			font-size: 1.05rem;
		}
	}
</style>
