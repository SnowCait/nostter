<script lang="ts">
	import { getTitle } from '$lib/EventHelper';
	import type { EventItem, Item } from '$lib/Items';
	import ActionMenu from '../actions/ActionMenu.svelte';
	import Content from '../Content.svelte';
	import Imeta from '../content/Imeta.svelte';
	import EventMetadata from '../EventMetadata.svelte';

	export let item: Item;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	$: eventItem = item as EventItem;
	$: title = getTitle(item.event.tags);
	$: pictures = item.event.tags.filter(([tagName]) => tagName === 'imeta');
</script>

<EventMetadata {item} {createdAtFormat}>
	<section slot="content">
		{#if title}
			<h3>{title}</h3>
		{/if}
		<Content content={item.event.content} tags={item.event.tags} />
		{#each pictures as picture}
			<Imeta tag={picture} />
		{/each}
		{#if !readonly}
			<ActionMenu item={eventItem} />
		{/if}
	</section>
</EventMetadata>
