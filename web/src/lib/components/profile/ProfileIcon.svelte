<script lang="ts">
	import { type Metadata } from '$lib/Items';
	import Picture from '../content/Picture.svelte';

	export let metadata: Metadata;
	export let width = '100%';
	export let height = '100%';

	const pictureStyle = {
		width,
		height,
		'border-radius': '50%',
		'object-fit': 'cover',
		'vertical-align': 'text-bottom'
	};
</script>

<Picture src={metadata.picture} pubkey={metadata.event.pubkey} style={pictureStyle} />
