<script lang="ts">
	import { metadataStore } from '$lib/cache/Events';
	import { robohash } from '$lib/Items';

	interface Props {
		pubkey: string;
		width?: string;
		height?: string;
		tooltip?: boolean;
	}

	let { pubkey, width = '100%', height = '100%', tooltip = true }: Props = $props();

	let metadata = $derived($metadataStore.get(pubkey));
	let name = $derived(metadata?.displayName ?? '');

	const onError = (event: Event) => {
		const img = event.target as HTMLImageElement;
		const url = robohash(pubkey);
		if (img.src !== url) {
			img.src = url;
		}
	};
</script>

<img
	src={metadata?.picture ?? robohash(pubkey)}
	alt=""
	title={tooltip ? name : ''}
	style="width: {width}; height: {height};"
	onerror={onError}
/>

<style>
	img {
		border-radius: 50%;
		object-fit: cover;
		vertical-align: text-bottom;
	}
</style>
