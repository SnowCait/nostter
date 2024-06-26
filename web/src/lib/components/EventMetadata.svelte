<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { robohash, type EventItem, type Item, alternativeName } from '$lib/Items';
	import { metadataStore } from '$lib/cache/Events';
	import UserStatus from './UserStatus.svelte';
	import CreatedAt from './CreatedAt.svelte';

	export let item: Item;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	$: eventItem = item as EventItem;
	$: metadata = $metadataStore.get(eventItem.event.pubkey);
</script>

<article class="timeline-item">
	<div>
		<a href="/{nip19.npubEncode(item.event.pubkey)}">
			<img class="picture" src={metadata?.picture ?? robohash(item.event.pubkey)} alt="" />
		</a>
		<div class="icon">
			<slot name="icon" />
		</div>
	</div>
	<div class="note">
		<div class="user">
			<div class="display_name">
				{metadata?.displayName ?? alternativeName(item.event.pubkey)}
			</div>
			{#if metadata !== undefined && metadata.displayName !== metadata.name}
				<div class="name">
					@{metadata.name ?? alternativeName(item.event.pubkey)}
				</div>
			{/if}
			<div class="created_at">
				<CreatedAt createdAt={item.event.created_at} format={createdAtFormat} />
			</div>
		</div>
		<div>
			<UserStatus pubkey={item.event.pubkey} />
		</div>
		<slot name="content" />
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

	.icon {
		margin-left: 15px;
	}

	:global(.icon svg) {
		width: 18px;
		height: 18px;
	}

	.note {
		color: var(--foreground);
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
		gap: 0.3rem;
	}

	.display_name {
		font-weight: 700;
		flex-shrink: 1;
	}

	.name {
		color: var(--accent-gray);
		font-size: 15px;
		flex-shrink: 2;
	}

	.display_name,
	.name {
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}

	.created_at {
		margin-left: auto;
		flex-shrink: 0;
	}
</style>
