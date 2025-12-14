<script lang="ts">
	import Content from '../Content.svelte';
	import { addressRegexp, hexRegexp } from '$lib/Constants';
	import EventMetadata from '../EventMetadata.svelte';
	import type { Item } from '$lib/Items';
	import ExternalLink from '../ExternalLink.svelte';
	import OnelineProfile from '../profile/OnelineProfile.svelte';
	import { nip19 } from 'nostr-tools';
	import { page } from '$app/stores';
	import { metadataStore, replaceableEventsStore } from '$lib/cache/Events';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { IconQuoteFilled } from '@tabler/icons-svelte';

	export let item: Item;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	$: event = item.event;

	$: sourceAddress = event.tags.find((tag) => tag[0] === 'a' && addressRegexp.test(tag[1]))?.[1];
	$: sourceId = event.tags.find((tag) => tag[0] === 'e' && hexRegexp.test(tag[1]))?.[1];
	$: sourceUrl = event.tags.find(
		(tag) => tag[0] === 'r' && URL.canParse(tag[1]) && tag[2] === 'source'
	)?.[1];

	$: authorsOrEditors = event.tags
		.filter((tag) => tag[0] === 'p' && hexRegexp.test(tag[1]) && tag[3] !== 'mention')
		.map(([, pubkey]) => pubkey);

	$: context = event.tags.find((tag) => tag[0] === 'context' && tag[1])?.[1];
	$: comment = event.tags.find((tag) => tag[0] === 'comment' && tag[1])?.[1];
</script>

<EventMetadata {item} {createdAtFormat}>
	<section slot="content" class="highlight">
		{#if comment}
			<div class="comment">
				<Content content={comment} tags={event.tags} />
			</div>
		{/if}

		{#if event.content}
			<blockquote>
				<div>
					<IconQuoteFilled size={30} />
				</div>
				<div>
					<main>
						{#if context}
							<i>
								<Content content={context} tags={event.tags} />
							</i>
						{/if}
						<Content content={event.content} tags={event.tags} />
					</main>
					<footer>
						{#if authorsOrEditors.length > 0}
							<div>
								{#each authorsOrEditors as pubkey}
									{@const metadata = $metadataStore.get(pubkey)}
									<span>
										<a
											href="/{nip19.nprofileEncode({
												pubkey,
												relays: metadata
													? getSeenOnRelays(metadata.event.id)
													: undefined
											})}"
										>
											<OnelineProfile {pubkey} />
										</a>
									</span>
								{/each}
							</div>
						{/if}
						{#if sourceAddress}
							{@const [kind, pubkey, identifier] = sourceAddress.split(':')}
							{@const naddr = nip19.naddrEncode({
								kind: Number(kind),
								pubkey,
								identifier,
								relays: $replaceableEventsStore.has(sourceAddress)
									? getSeenOnRelays(
											$replaceableEventsStore.get(sourceAddress)?.id ?? ''
										)
									: undefined
							})}
							<div>
								<ExternalLink link={new URL(`${$page.url.origin}/${naddr}`)} />
							</div>
						{:else if sourceId}
							{@const nevent = nip19.neventEncode({
								id: sourceId,
								relays: getSeenOnRelays(sourceId)
							})}
							<div>
								<ExternalLink link={new URL(`${$page.url.origin}/${nevent}`)} />
							</div>
						{/if}
						{#if sourceUrl}
							<div>
								<ExternalLink link={new URL(sourceUrl)} />
							</div>
						{/if}
					</footer>
				</div>
			</blockquote>
		{/if}
	</section>
</EventMetadata>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0.2rem 0;
	}

	blockquote {
		display: flex;
		justify-content: flex-start;
		gap: 1rem;
		padding: 1rem;
	}

	blockquote > div:first-child {
		color: var(--accent);
	}

	blockquote div:last-child {
		min-width: 0;
	}

	main {
		max-width: 100%;
		overflow-wrap: break-word;
		word-wrap: break-word;
		min-width: 0;
	}

	footer {
		margin: 1rem 0;
	}

	footer > div {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	a {
		text-decoration: none;
	}
</style>
