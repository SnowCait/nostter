<script lang="ts">
	import { metadataStore } from '$lib/cache/Events';
	import { robohash } from '$lib/Items';

	export let pubkey: string;
	export let width = '100%';
	export let height = '100%';
	export let tooltip = true;

	$: metadata = $metadataStore.get(pubkey);
	$: name = metadata?.displayName ?? '';

	const onError = (event: Event) => {
		const img = event.target as HTMLImageElement;
		img.src = robohash(pubkey);
	};
</script>

<img
	src={metadata?.picture ?? robohash(pubkey)}
	alt={name}
	title={tooltip ? name : ''}
	style="width: {width}; height: {height};"
	on:error={onError}
/>

<style>
	img {
		border-radius: 50%;
		object-fit: cover;
		vertical-align: text-bottom;
	}
</style>
