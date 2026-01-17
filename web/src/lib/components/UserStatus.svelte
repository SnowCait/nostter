<script lang="ts">
	import type { Event } from 'nostr-tools';
	import { chronological } from '$lib/Constants';
	import { findIdentifier } from '$lib/EventHelper';
	import { userStatusesMap } from '$lib/UserStatus';
	import { IconMusic, IconUser } from '@tabler/icons-svelte';
	import EmojifiedContent from './EmojifiedContent.svelte';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	let generalEvent = $state<Event>();
	let musicEvent = $state<Event>();

	$effect(() => {
		const statuses = $userStatusesMap.get(pubkey) ?? [];
		statuses.sort(chronological);
		generalEvent = statuses.findLast((event) => findIdentifier(event.tags) === 'general');
		musicEvent = statuses.findLast((event) => findIdentifier(event.tags) === 'music');
	});
</script>

<section>
	{#if generalEvent !== undefined && generalEvent.content !== ''}
		<div class="general">
			<span><IconUser size="14" /></span>
			<span class="content">
				<EmojifiedContent content={generalEvent.content} tags={generalEvent.tags} />
			</span>
		</div>
	{/if}
	{#if musicEvent !== undefined && musicEvent.content !== ''}
		<div class="music">
			<span><IconMusic size="14" /></span>
			<span class="content">
				<EmojifiedContent content={musicEvent.content} tags={musicEvent.tags} />
			</span>
		</div>
	{/if}
</section>

<style>
	section {
		display: flex;
		flex-direction: row;
		gap: 0.5rem;
	}

	div {
		color: var(--accent-gray);
		font-size: 0.7rem;

		text-overflow: ellipsis;
		overflow: hidden;

		display: flex;
		flex-direction: row;
	}

	.general {
		flex-shrink: 1;
	}

	.music {
		flex-shrink: 2;
	}

	span {
		flex-shrink: 0;
	}

	span.content {
		flex-shrink: 1;

		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}
</style>
