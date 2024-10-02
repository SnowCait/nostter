<script lang="ts">
	import { page } from '$app/stores';
	import '@tabler/icons-webfont/dist/tabler-icons.min.css';

	export let link: URL;

	const threshold = 64;

	$: isInternal = link.origin === $page.url.origin; // Exception
	$: content = link.hostname + link.pathname + link.search + link.hash;
	$: shortenedContent =
		content.length < threshold ? content : content.substring(0, threshold) + '...';
</script>

{#if isInternal}
	<a href={link.href.substring(link.origin.length)}>
		<slot>{shortenedContent}</slot>
	</a>
{:else}
	<a href={link.href} target="_blank" rel="noopener noreferrer" class="external">
		<slot>{shortenedContent}</slot>
	</a>
{/if}

<style>
	a.external::after {
		font-family: 'tabler-icons';
		content: '\ea99';
	}
</style>
