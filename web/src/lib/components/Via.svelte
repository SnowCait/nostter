<script lang="ts">
	export let tags: string[][];
</script>

{#each tags.filter(([tagName, tagContent]) => tagName === 'client' && tagContent) as tag}
	<div>via {tag[1]}</div>
{/each}

<style>
	div {
		color: var(--accent-gray);
	}
</style>
