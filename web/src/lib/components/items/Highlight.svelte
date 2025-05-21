<script lang="ts">
	import Content from '../Content.svelte';
	import { addressRegexp, hexRegexp } from '$lib/Constants';
	import EventMetadata from '../EventMetadata.svelte';
	import type { Item } from '$lib/Items';
	import { Blockquote } from '@svelteuidev/core';
	import ExternalLink from '../ExternalLink.svelte';
	import OnelineProfile from '../profile/OnelineProfile.svelte';
	import { nip19 } from 'nostr-tools';

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
			<Blockquote>
				{#if context}
					<i>
						<Content content={context} tags={event.tags} />
					</i>
				{/if}
				<Content content={event.content} tags={event.tags} />
				<svelte:fragment slot="cite">
					{#if authorsOrEditors.length > 0}
						<div>
							{#each authorsOrEditors as pubkey}
								<span>
									<a href="/{nip19.nprofileEncode({ pubkey })}">
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
							identifier
						})}
						<span>
							<a href="/{naddr}">{naddr.substring(0, 'naddr1'.length + 7)}</a>
						</span>
					{:else if sourceId}
						{@const nevent = nip19.neventEncode({ id: sourceId })}
						<span>
							<a href="/{nevent}">{nevent.substring(0, 'nevent1'.length + 7)}</a>
						</span>
					{/if}
					{#if sourceUrl}
						<span>
							<ExternalLink link={new URL(sourceUrl)} />
						</span>
					{/if}
				</svelte:fragment>
			</Blockquote>
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

	a {
		text-decoration: none;
	}

	:global(.highlight blockquote:not(.canTransition-post .highlight blockquote)) {
		cursor: initial;
	}

	:global(.highlight blockquote:hover:not(.canTransition-post .highlight blockquote)) {
		background: initial;
	}
</style>
