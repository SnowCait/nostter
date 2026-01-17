<script lang="ts">
	import { getListTitle } from '$lib/List';
	import type { Event } from 'nostr-typedef';
	import CustomEmojiMenuButton from '../actions/CustomEmojiMenuButton.svelte';
	import CustomEmoji from '../content/CustomEmoji.svelte';
	import IconMoodSmile from '@tabler/icons-svelte/icons/mood-smile';
	import OnelineProfile from '../profile/OnelineProfile.svelte';

	interface Props {
		event: Event;
	}

	let { event }: Props = $props();

	let title = $derived(getListTitle(event.tags));
</script>

<article class="timeline-item">
	<h1>
		<IconMoodSmile />
		<div>{title}</div>
		<div><CustomEmojiMenuButton {event} /></div>
	</h1>

	<div>
		<span>by</span>
		<span><OnelineProfile pubkey={event.pubkey} /></span>
	</div>

	<ul>
		{#each event.tags.filter(([tagName, shortcode, imageUrl]) => tagName === 'emoji' && shortcode !== undefined && imageUrl !== undefined) as tag}
			<CustomEmoji text={tag[1]} url={tag[2]} />
		{/each}
	</ul>
</article>

<style>
	h1 {
		font-size: 1.5rem;
		color: var(--foreground);
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	h1 div:last-child {
		margin-left: auto;
	}

	ul {
		list-style: none;
		margin: 1rem auto;
		display: flex;
		flex-wrap: wrap;
	}
</style>
