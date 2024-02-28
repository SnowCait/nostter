<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { Event } from 'nostr-typedef';
	import { nip19 } from 'nostr-tools';
	import { replaceableEventsStore, metadataStore } from '$lib/cache/Events';
	import { filterTags } from '$lib/EventHelper';
	import { alternativeName, type Item } from '$lib/Items';
	import { pubkey, rom } from '../../../stores/Author';
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';
	import IconAward from '@tabler/icons-svelte/dist/svelte/icons/IconAward.svelte';
	import BadgeDefinition from './BadgeDefinition.svelte';
	import CreatedAt from '../../../routes/(app)/CreatedAt.svelte';
	import ExternalLink from '../ExternalLink.svelte';

	export let item: Item;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	const { event } = item;
	const aTagContents = filterTags('a', event.tags);

	$: metadata = $metadataStore.get(event.pubkey);
	$: badgeDefinitions = aTagContents
		.map((a) => $replaceableEventsStore.get(a))
		.filter((event): event is Event => event !== undefined);

	let jsonDisplay = false;

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};
</script>

<article class="timeline-item">
	<header>
		<div>
			<IconAward size={18} color={'orange'} />
		</div>
		<div>by</div>
		<div>
			<a href="/{nip19.npubEncode(event.pubkey)}">
				@{metadata?.name ?? alternativeName(event.pubkey)}
			</a>
		</div>
		<div class="json-button">
			<button on:click={toggleJsonDisplay} class="clear">
				<IconCodeDots size={18} />
			</button>
		</div>
		<div class="created-at">
			<CreatedAt createdAt={event.created_at} format={createdAtFormat} />
		</div>
	</header>
	<main>
		{#each badgeDefinitions as event}
			<BadgeDefinition {event} />
			{#if !readonly && !$rom}
				<ExternalLink link={new URL(`https://badges.page/p/${nip19.npubEncode($pubkey)}`)}>
					{$_('badge.accept')}
				</ExternalLink>
			{/if}
		{/each}
	</main>
</article>
{#if jsonDisplay}
	<div class="develop">
		<h5>Event ID</h5>
		<div>{nip19.noteEncode(event.id)}</div>
		<br />
		<div>{nip19.neventEncode({ id: event.id })}</div>
		<h5>Event JSON</h5>
		<code>{JSON.stringify(event, null, 2)}</code>
		<h5>User ID</h5>
		<div>{nip19.npubEncode(event.pubkey)}</div>
		<h5>User JSON</h5>
		<code>{JSON.stringify(metadata?.content, null, 2)}</code>
		<div>
			Open in <a
				href="https://koteitan.github.io/nostr-post-checker/?hideform&eid={nip19.neventEncode(
					{
						id: event.id
					}
				)}&kind={event.kind}"
				target="_blank"
				rel="noopener noreferrer"
			>
				nostr-post-checker
			</a>
		</div>
	</div>
{/if}

<style>
	header {
		display: flex;
		flex-direction: row;
	}

	header div {
		margin-right: 0.2em;
	}

	.json-button {
		margin-left: auto;
	}

	button {
		color: lightgray;
		height: 20px;
	}
</style>
