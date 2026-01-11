<script lang="ts">
	import { page } from '$app/stores';
	import '@tabler/icons-webfont/dist/tabler-icons.min.css';

	interface Props {
		link: URL;
		children?: import('svelte').Snippet;
	}

	let { link, children }: Props = $props();

	const threshold = 64;

	let isInternal = $derived(link.origin === $page.url.origin); // Exception
	let content = $derived(link.hostname + link.pathname + link.search + link.hash);
	let shortenedContent =
		$derived(content.length < threshold ? content : content.substring(0, threshold) + '...');
</script>

{#if isInternal}
	<a href={link.href.substring(link.origin.length)}>
		{#if children}{@render children()}{:else}{shortenedContent}{/if}
	</a>
{:else}
	<a href={link.href} target="_blank" rel="noopener noreferrer" class="external">
		{#if children}{@render children()}{:else}{shortenedContent}{/if}
	</a>
{/if}

<style>
	a.external::after {
		font-family: 'tabler-icons';
		content: '\ea99';
	}
</style>
