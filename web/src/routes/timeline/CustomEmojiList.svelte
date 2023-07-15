<script lang="ts">
	import CustomEmoji from '../content/CustomEmoji.svelte';

	export let tags: string[][];
</script>

<ul>
	{#each tags.filter(([tagName, shortcode, imageUrl]) => tagName === 'emoji' && shortcode !== undefined && imageUrl !== undefined) as tag}
		<CustomEmoji text={tag[1]} url={tag[2]} />
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		padding: 0;
		display: flex;
	}
</style>
