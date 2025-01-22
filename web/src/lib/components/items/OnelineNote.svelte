<script lang="ts">
	import { metadataStore } from '$lib/cache/Events';
	import { robohash, type EventItem } from '$lib/Items';
	import IconMessageCircle from '@tabler/icons-svelte/icons/message-circle';
	import OnelineContent from '../OnelineContent.svelte';

	export let item: EventItem;

	$: metadata = item ? $metadataStore.get(item.event.pubkey) : undefined;
</script>

<article class="timeline-item">
	<div class="icon"><IconMessageCircle /></div>
	<div><img src={metadata?.picture ?? robohash(item.event.pubkey)} alt="" /></div>
	<div class="content">
		<OnelineContent content={item.event.content} tags={item.event.tags} />
	</div>
</article>

<style>
	article {
		display: flex;
		justify-content: flex-start;
		gap: 0.5rem;
	}

	.icon {
		color: var(--accent-gray);
		margin: auto 0;
	}

	img {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
	}

	.content {
		overflow: hidden;
		text-overflow: ellipsis;
		text-wrap: nowrap;
	}
</style>
