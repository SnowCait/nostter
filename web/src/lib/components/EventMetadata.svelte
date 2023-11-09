<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import type { EventItem, Item } from '$lib/Items';
	import { metadataStore } from '$lib/cache/Events';
	import CreatedAt from '../../routes/(app)/CreatedAt.svelte';

	export let item: Item;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	$: eventItem = item as EventItem;
	$: metadata = $metadataStore.get(eventItem.event.pubkey);
</script>

<article class="timeline-item">
	<div>
		<a href="/{nip19.npubEncode(item.event.pubkey)}">
			<img class="picture" src={metadata?.picture} alt="" />
		</a>
	</div>
	<div class="note">
		<div class="user">
			<div class="display_name">
				{metadata?.content?.display_name
					? metadata?.content.display_name
					: metadata?.content?.name}
			</div>
			<div class="name">
				@{metadata?.content?.name
					? metadata?.content.name
					: metadata?.content?.display_name}
			</div>
			<div class="created_at">
				<CreatedAt createdAt={item.event.created_at} format={createdAtFormat} />
			</div>
		</div>
		<slot />
	</div>
</article>

<style>
	article {
		display: flex;
		flex-direction: row;
	}

	.picture {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		margin-right: 12px;
		object-fit: cover;
	}

	.note {
		color: rgb(15, 20, 25);
		font-size: 15px;
		font-weight: 400;
		width: calc(100% - 60px);

		/* Workaround for unnecessary space */
		display: flex;
		flex-direction: column;
	}

	.user {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
	}

	.display_name {
		margin-right: 4px;
		font-weight: 700;
	}

	.name {
		color: rgb(83, 100, 113);
		font-size: 15px;
	}

	.display_name,
	.name {
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}

	.created_at {
		margin-left: auto;
	}
</style>
