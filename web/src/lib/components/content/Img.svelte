<script lang="ts">
	import { imageOptimization, imageOptimizationEndpoint } from '$lib/stores/Preference';
	import { Img, type ImgSrc } from 'svelte-remote-image';

	export let url: URL;

	const { href: src, pathname } = url;

	let imageSrc: ImgSrc = {
		img: `${$imageOptimizationEndpoint}width=800,quality=60,format=webp/${src}`,
		fallback: [src]
	};
</script>

<div class="img-wrapper">
	{#if $imageOptimization && /\.(avif|jpg|jpeg|png|webp)$/i.test(pathname) && !src.startsWith($imageOptimizationEndpoint)}
		<Img class="global-content-image" src={imageSrc} alt={src} />
	{:else}
		<img class="global-content-image" {src} alt={src} />
	{/if}
</div>

<style>
	.img-wrapper :global(.global-content-image) {
		max-width: calc(100% - 1.5em);
		max-height: 20em;
		margin: 0.5em;
		border: 1px solid lightgray;
		border-radius: 5px;
		vertical-align: middle;
	}
</style>
