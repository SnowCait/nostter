<script lang="ts">
	import { filterTags } from '$lib/EventHelper';
	import type { EventItem, Item } from '$lib/Items';
	import ActionMenu from '../actions/ActionMenu.svelte';
	import Content from '../Content.svelte';
	import Imeta from '../content/Imeta.svelte';
	import EventMetadata from '../EventMetadata.svelte';

	interface Props {
		item: Item;
		readonly: boolean;
		createdAtFormat?: 'auto' | 'time';
	}

	let { item, readonly, createdAtFormat = 'auto' }: Props = $props();

	let eventItem = $derived(item as EventItem);
	let title = $derived(filterTags('title', item.event.tags).at(0));
	let pictures = $derived(item.event.tags.filter(([tagName]) => tagName === 'imeta'));
</script>

<EventMetadata {item} {createdAtFormat}>
	{#snippet content()}
		<section>
			<div class="content">
				{#if title}
					<h3>{title}</h3>
				{/if}
				<Content content={item.event.content} tags={item.event.tags} />
			</div>
			{#each pictures as picture}
				<Imeta tag={picture} />
			{/each}
			{#if !readonly}
				<ActionMenu item={eventItem} />
			{/if}
		</section>
	{/snippet}
</EventMetadata>

<style>
	.content {
		font-size: calc(15px * var(--content-font-scale));
		--applied-content-font-scale: var(--content-font-scale);
	}
</style>
