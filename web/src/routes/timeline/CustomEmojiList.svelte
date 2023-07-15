<script lang="ts">
	export let tags: string[][];
</script>

<ul>
	{#each tags.filter(([tagName, shortcode, imageUrl]) => tagName === 'emoji' && shortcode !== undefined && imageUrl !== undefined) as tag}
		<img src={tag[2]} alt={tag[1]} title={tag[1]} />
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		padding: 0;
		display: flex;
	}
	img {
		max-height: 1.5rem;
	}
</style>
