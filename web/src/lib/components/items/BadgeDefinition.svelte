<script lang="ts">
	import type { Event } from 'nostr-typedef';
	import { getTagContent } from '$lib/EventHelper';

	interface Props {
		event: Event;
		children?: import('svelte').Snippet;
	}

	let { event, children }: Props = $props();

	let name = $derived(getTagContent('name', event.tags));
	let description = $derived(getTagContent('description', event.tags));
	let url = $derived(getTagContent('image', event.tags));
</script>

<article>
	<img src={url} alt="" />
	<main>
		<h2>{name}</h2>
		<p>{description}</p>
		{@render children?.()}
	</main>
</article>

<style>
	article {
		display: flex;
		flex-direction: row;
	}

	img {
		width: 200px;
		height: 200px;
	}

	main {
		margin-left: 1rem;
	}

	p {
		margin: 1rem auto;
	}
</style>
