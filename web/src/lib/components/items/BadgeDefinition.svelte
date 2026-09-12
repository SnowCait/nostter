<script lang="ts">
	import type * as Nostr from 'nostr-typedef';

	interface Props {
		event: Nostr.Event;
		children?: import('svelte').Snippet;
	}

	let { event, children }: Props = $props();

	function getTagContent(tagName: string, tags: string[][]): string {
		const tagContent = tags.find(([n]) => n === tagName)?.at(1);
		return tagContent ?? (tagName === 'd' ? '' : getTagContent('d', tags));
	}

	let name = $derived(getTagContent('name', event.tags));
	let description = $derived(getTagContent('description', event.tags));
	let url = $derived(getTagContent('image', event.tags));
</script>

<article>
	<img src={url} alt="" loading="lazy" decoding="async" />
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
