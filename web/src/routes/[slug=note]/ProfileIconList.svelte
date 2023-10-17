<script lang="ts">
	import type { Metadata } from '$lib/Items';
	import ProfileIcon from './ProfileIcon.svelte';

	export let metadataList: (Metadata | undefined)[];
</script>

<ul class="clear">
	{#each metadataList as metadata}
		<li>
			{#if metadata !== undefined}
				<ProfileIcon {metadata} />
			{/if}
		</li>
	{/each}
</ul>

<style>
	ul {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		margin: 0.2rem 0;
	}
</style>
