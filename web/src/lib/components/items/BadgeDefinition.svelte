<script lang="ts">
	import type { Event } from 'nostr-typedef';
	import { getTagContent } from '$lib/EventHelper';

	export let event: Event;

	$: name = getTagContent('name', event.tags);
	$: description = getTagContent('description', event.tags);
	$: url = getTagContent('image', event.tags);
</script>

<article>
	<img src={url} alt="" />
	<main>
		<h2>{name}</h2>
		<p>{description}</p>
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

	h2 {
		margin-bottom: 1rem;
	}
</style>
