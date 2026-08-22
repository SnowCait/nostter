<script lang="ts">
	import { page } from '$app/stores';
	import externalLinkIconUrl from '$lib/assets/icons/external-link.svg?url';
	import { isHttpUrl } from '$lib/url';

	interface Props {
		link: URL;
		children?: import('svelte').Snippet;
	}

	let { link, children }: Props = $props();

	const threshold = 64;

	let isSafe = $derived(isHttpUrl(link));
	let isInternal = $derived(link.origin === $page.url.origin); // Exception
	let content = $derived(link.hostname + link.pathname + link.search + link.hash);
	let shortenedContent = $derived(
		content.length < threshold ? content : content.substring(0, threshold) + '...'
	);
</script>

{#if !isSafe}
	{#if children}{@render children()}{:else}{link.href}{/if}
{:else if isInternal}
	<a href={link.href.substring(link.origin.length)}>
		{#if children}{@render children()}{:else}{shortenedContent}{/if}
	</a>
{:else}
	<a
		href={link.href}
		target="_blank"
		rel="noopener noreferrer"
		class="external"
		style:--external-link-icon={`url("${externalLinkIconUrl}")`}
	>
		{#if children}{@render children()}{:else}{shortenedContent}{/if}
	</a>
{/if}

<style>
	a.external::after {
		content: '';
		display: inline-block;
		width: 1em;
		height: 1em;
		vertical-align: -0.125em;
		background-color: currentColor;
		mask: var(--external-link-icon) center / contain no-repeat;
		-webkit-mask: var(--external-link-icon) center / contain no-repeat;
	}
</style>
