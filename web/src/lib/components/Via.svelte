<script lang="ts">
	import ExternalLink from './ExternalLink.svelte';

	interface Props {
		tags: string[][];
		clientLinks?: ReadonlyMap<string, URL>;
	}

	let { tags, clientLinks }: Props = $props();
</script>

{#each tags.filter(([tagName, tagContent]) => tagName === 'client' && tagContent) as [, name, address]}
	{@const link = address === undefined ? undefined : clientLinks?.get(address)}
	<div>
		via {#if link !== undefined}<ExternalLink {link}>{name}</ExternalLink>{:else}{name}{/if}
	</div>
{/each}

<style>
	div {
		color: var(--accent-gray);
	}
</style>
