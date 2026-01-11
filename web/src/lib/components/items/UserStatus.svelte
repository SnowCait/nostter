<script lang="ts">
	import type { Item } from '$lib/Items';
	import EventMetadata from '$lib/components/EventMetadata.svelte';
	import Content from '$lib/components/Content.svelte';
	import IconUser from '@tabler/icons-svelte/icons/user';
	import IconMusic from '@tabler/icons-svelte/icons/music';
	import IconQuestionMark from '@tabler/icons-svelte/icons/question-mark';
	import IconLink from '@tabler/icons-svelte/icons/link';

	interface Props {
		item: Item;
		createdAtFormat?: 'auto' | 'time';
	}

	let { item, createdAtFormat = 'auto' }: Props = $props();

	let identifier = $derived(item.event.tags.find(([tagName]) => tagName === 'd')?.at(1) ?? '');
	let link = $derived(item.event.tags.find(([tagName, url]) => tagName === 'r' && url !== undefined)?.at(1));
</script>

<EventMetadata {item} {createdAtFormat}>
	{#snippet icon()}
	
			{#if identifier === 'general'}
				<IconUser />
			{:else if identifier === 'music'}
				<IconMusic />
			{:else}
				<IconQuestionMark />
			{/if}
		
	{/snippet}
	{#snippet content()}
		<section >
			<Content content={item.event.content} tags={item.event.tags} />
			{#if link !== undefined}
				<a href={link} target="_blank" rel="noopener noreferrer">
					<IconLink size="1rem" />
					<span>{link}</span>
				</a>
			{/if}
		</section>
	{/snippet}
</EventMetadata>

<style>
	a {
		display: flex;
		flex-direction: row;
		align-items: center;
	}

	span {
		margin-left: 0.2rem;
		width: calc(100% - 1.2rem);
		overflow: hidden;
		text-overflow: ellipsis;
		text-wrap: nowrap;
	}
</style>
