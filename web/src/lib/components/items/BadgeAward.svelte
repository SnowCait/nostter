<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { Event } from 'nostr-typedef';
	import { nip19 } from 'nostr-tools';
	import { acceptBadge, profileBadgesEvent } from '$lib/author/ProfileBadges';
	import { replaceableEventsStore, metadataStore } from '$lib/cache/Events';
	import { aTagContent, filterTags } from '$lib/EventHelper';
	import { type Item } from '$lib/Items';
	import { rom } from '$lib/stores/Author';
	import { developerMode } from '$lib/stores/Preference';
	import IconCodeDots from '@tabler/icons-svelte/icons/code-dots';
	import IconAward from '@tabler/icons-svelte/icons/award';
	import BadgeDefinition from './BadgeDefinition.svelte';
	import CreatedAt from '../CreatedAt.svelte';
	import OnelineProfile from '../profile/OnelineProfile.svelte';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import SeenOnRelays from '../SeenOnRelays.svelte';

	interface Props {
		item: Item;
		readonly: boolean;
		createdAtFormat?: 'auto' | 'time';
	}

	let { item, readonly, createdAtFormat = 'auto' }: Props = $props();

	const { event } = item;
	const aTagContents = filterTags('a', event.tags);

	let metadata = $derived($metadataStore.get(event.pubkey));
	let nevent = $derived(
		nip19.neventEncode({
			id: event.id,
			relays: getSeenOnRelays(event.id),
			author: event.pubkey,
			kind: event.kind
		})
	);
	let badgeDefinitions = $derived(
		aTagContents
			.map((a) => $replaceableEventsStore.get(a))
			.filter((event): event is Event => event !== undefined)
	);
	let myBadgeDefinitionsA = $derived(filterTags('a', $profileBadgesEvent?.tags ?? []));

	let jsonDisplay = $state(false);

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};

	function accept(badgeDefinitionEvent: Event): void {
		console.log('[badge accept]', badgeDefinitionEvent, event);

		const a = aTagContent(badgeDefinitionEvent);
		acceptBadge(a, event.id);
	}
</script>

<article class="timeline-item">
	<header>
		<div>
			<IconAward size={18} color={'orange'} />
		</div>
		<div>by</div>
		<div class="profile">
			<a href="/{nip19.npubEncode(event.pubkey)}">
				<OnelineProfile pubkey={event.pubkey} />
			</a>
		</div>
		{#if $developerMode}
			<div class="json-button right">
				<button onclick={toggleJsonDisplay} class="clear">
					<IconCodeDots size={18} />
				</button>
			</div>
		{/if}
		<div class="created-at" class:right={!$developerMode}>
			<CreatedAt createdAt={event.created_at} format={createdAtFormat} />
		</div>
	</header>
	<main>
		{#each badgeDefinitions as event}
			<BadgeDefinition {event}>
				{#if !readonly && !$rom}
					{@const own = myBadgeDefinitionsA.includes(aTagContent(event))}
					<button class="round" disabled={own} onclick={() => accept(event)}>
						{#if own}
							{$_('badge.accepted')}
						{:else}
							{$_('badge.accept')}
						{/if}
					</button>
				{/if}
			</BadgeDefinition>
		{/each}
	</main>
</article>
{#if jsonDisplay}
	<div class="develop">
		<h5>Event ID</h5>
		<div>{nip19.noteEncode(event.id)}</div>
		<br />
		<div>{nevent}</div>
		<h5>Event JSON</h5>
		<code>{JSON.stringify(event, null, 2)}</code>
		<h5>User ID</h5>
		<div>{nip19.npubEncode(event.pubkey)}</div>
		<h5>User JSON</h5>
		<code>{JSON.stringify(metadata?.content, null, 2)}</code>
		<SeenOnRelays id={event.id} />
		<div>
			Open in <a
				href="https://koteitan.github.io/nostr-post-checker/?hideform&eid={nevent}&kind={event.kind}"
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
		gap: 0.2rem;
	}

	.json-button {
		margin: auto 0;
	}

	.json-button button {
		color: var(--accent-gray);
		display: flex;
	}

	.profile {
		overflow: hidden;
		text-overflow: ellipsis;
		text-wrap: nowrap;
	}

	.profile a {
		text-decoration: none;
	}

	.right {
		margin-left: auto;
	}
</style>
