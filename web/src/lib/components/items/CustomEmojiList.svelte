<script lang="ts">
	import { getListTitle } from '$lib/List';
	import type { Event } from 'nostr-typedef';
	import CustomEmojiMenuButton from '../actions/CustomEmojiMenuButton.svelte';
	import CustomEmoji from '../content/CustomEmoji.svelte';
	import IconMoodSmile from '@tabler/icons-svelte/icons/mood-smile';

	export let event: Event;

	$: title = getListTitle(event.tags);
</script>

<article class="timeline-item">
	<h1>
		<IconMoodSmile />
		<span>{title}</span>
		<span class="menu"><CustomEmojiMenuButton {event} /></span>
	</h1>

	<ul>
		{#each event.tags.filter(([tagName, shortcode, imageUrl]) => tagName === 'emoji' && shortcode !== undefined && imageUrl !== undefined) as tag}
			<CustomEmoji text={tag[1]} url={tag[2]} />
		{/each}
	</ul>
</article>

<style>
	h1 {
		font-size: 1.8rem;
		color: var(--foreground);
		position: relative;
	}

	.menu {
		position: absolute;
		right: 0;
	}

	ul {
		list-style: none;
		margin: 1rem auto;
		display: flex;
		flex-wrap: wrap;
	}
</style>
