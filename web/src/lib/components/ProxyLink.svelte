<script lang="ts">
	import { IconLink } from '@tabler/icons-svelte-runes';
	import { resolveProxyUrl } from '$lib/nostr/nip48/proxy';
	import { isHttpUrl } from '$lib/url';

	interface Props {
		tag: string[];
	}

	let { tag }: Props = $props();

	let url = $derived(resolveProxyUrl(tag[1], tag[2]));
</script>

{#if url !== undefined && isHttpUrl(url)}
	<a href={url.href} target="_blank" rel="noopener noreferrer">
		<IconLink size="20" color="gray" />
		<span>{url.hostname}</span>
	</a>
{:else}
	<span class="fallback">
		<IconLink size="20" color="gray" />
		<span>{tag.at(1) ?? '-'}</span>
	</span>
{/if}

<style>
	a,
	.fallback {
		display: flex;
		flex-direction: row;
		align-items: center;
	}

	a span,
	.fallback span {
		margin-left: 0.2rem;
	}
</style>
