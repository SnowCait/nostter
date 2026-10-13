<script lang="ts">
	import { type EventItem } from '$lib/Items';
	import IconMessageCircle from '@tabler/icons-svelte-runes/icons/message-circle';
	import OnelineContent from '../OnelineContent.svelte';
	import ProfileIcon from '../profile/ProfileIcon.svelte';
	import { getContentWarning } from '$lib/nostr/protocol/nip36';

	interface Props {
		item: EventItem;
	}

	let { item }: Props = $props();

	let contentWarning = $derived(getContentWarning(item.event.tags));
</script>

<article class="timeline-item">
	<div class="icon"><IconMessageCircle /></div>
	<div class="picture"><ProfileIcon pubkey={item.event.pubkey} /></div>
	{#if contentWarning !== undefined}
		<div class="content-warning">
			<div>{contentWarning.reason ?? ''}</div>
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
		font-size: calc(1em * var(--content-font-scale) / var(--applied-content-font-scale, 1));
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
