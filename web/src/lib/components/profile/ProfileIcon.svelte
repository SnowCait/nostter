<script lang="ts">
	import { metadataStore } from '$lib/cache/Events';
	import Picture from '../content/Picture.svelte';

	export let pubkey: string;
	export let width = '100%';
	export let height = '100%';
	export let tooltip = true;
	export let size: string | undefined = undefined;

	$: metadata = $metadataStore.get(pubkey);
	$: name = metadata?.displayName ?? '';
</script>

<Picture
	src={metadata?.picture}
	{pubkey}
	style="width: {width}; height: {height};border-radius: 50%;object-fit: cover;vertical-align: text-bottom;"
	alt={name}
	title={tooltip ? name : ''}
	{size}
/>
