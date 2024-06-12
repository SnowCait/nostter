<script lang="ts">
	import { robohash, type Metadata } from '$lib/Items';

	export let metadata: Metadata;
	export let width = '100%';
	export let height = '100%';
</script>

<img
	src={metadata.picture ?? robohash(metadata.event.pubkey)}
	alt=""
	style="width: {width}; height: {height};"
/>

<style>
	img {
		border-radius: 50%;
		object-fit: cover;
		vertical-align: middle;
	}
</style>
