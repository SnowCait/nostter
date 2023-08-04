<script lang="ts">
	import type { Metadata } from '$lib/Items';
	import ProfileIcon from './ProfileIcon.svelte';

	export let metadataList: Metadata[];
</script>

<ul class="clear">
	{#each metadataList as metadata}
		<li>
			<ProfileIcon {metadata} />
		</li>
	{/each}
</ul>

<style>
	ul {
		display: flex;
		flex-direction: row;
		margin: 0.2rem 0;
	}
</style>
