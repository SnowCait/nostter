<script lang="ts">
	import { robohash, type Metadata } from '$lib/Items';

	export let metadata: Metadata;
</script>

<img src={metadata.picture ?? robohash(metadata.event.pubkey)} alt="" />

<style>
	img {
		width: 1.2rem;
		height: 1.2rem;
		border-radius: 50%;
		object-fit: cover;
		vertical-align: middle;
	}
</style>
