<script lang="ts">
	import { type EventItem } from '$lib/Items';
	import IconMessageCircle from '@tabler/icons-svelte/icons/message-circle';
	import OnelineContent from '../OnelineContent.svelte';
	import ProfileIcon from '../profile/ProfileIcon.svelte';

	interface Props {
		item: EventItem;
	}

	let { item }: Props = $props();

	let contentWarningTag = $derived(
		item.event.tags.find(([tagName]) => tagName === 'content-warning')
	);
</script>

<article class="timeline-item">
	<div class="icon"><IconMessageCircle /></div>
	<div class="picture"><ProfileIcon pubkey={item.event.pubkey} /></div>
	{#if contentWarningTag !== undefined}
		<div class="content-warning">
			<div>{contentWarningTag?.at(1) ?? ''}</div>
		</div>
	{:else}
		<div class="content">
			<OnelineContent content={item.event.content} tags={item.event.tags} />
		</div>
	{/if}
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

	.picture {
		width: 1.5rem;
		height: 1.5rem;
		min-width: 1.5rem; /* for flex */
	}

	.content {
		overflow: hidden;
		text-overflow: ellipsis;
		text-wrap: nowrap;
		color: var(--foreground);
	}
</style>
