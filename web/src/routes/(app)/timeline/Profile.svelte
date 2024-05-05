<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import FollowButton from '$lib/components/FollowButton.svelte';
	import { rom } from '$lib/stores/Author';
	import { lastNotesMap } from '$lib/stores/LastNotes';
	import Content from '../content/Content.svelte';
	import type { Metadata } from '$lib/Items';

	export let metadata: Metadata;

	$: createdAt = $lastNotesMap.get(metadata.event.pubkey)?.created_at;
</script>

<article class="timeline-item">
	<div>
		<a href="/{nip19.npubEncode(metadata.event.pubkey)}">
			<img class="picture" src={metadata.content?.picture} alt="" />
		</a>
	</div>
	<div class="text">
		<div class="row">
			<div class="display_name">
				{metadata.content?.display_name ?? metadata.content?.name}
			</div>
			<div class="name">@{metadata.content?.name ?? metadata.content?.display_name}</div>
			{#if !$rom}
				<div class="follow">
					<FollowButton pubkey={metadata.event.pubkey} />
				</div>
			{/if}
		</div>
		{#if metadata.content?.about !== undefined}
			<Content content={metadata.content.about} tags={metadata.event.tags} />
		{/if}
		{#if !$rom && createdAt !== undefined}
			<div>Last note: {new Date(createdAt * 1000).toLocaleString()}</div>
		{/if}
	</div>
</article>

<style>
	article {
		display: flex;
		flex-direction: row;
	}

	img {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		object-fit: cover;

		margin-right: 12px;
	}

	.text {
		width: 100%;
	}

	.row {
		display: flex;
		flex-direction: row;
	}

	.display_name {
		margin-right: 4px;
		font-weight: 700;
	}

	.name {
		color: var(--accent-gray);
		font-size: 15px;
	}

	.display_name,
	.name {
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}

	.follow {
		margin-left: auto;
	}
</style>
