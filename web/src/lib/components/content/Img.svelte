<script lang="ts">
	import { imageOptimization } from '$lib/stores/Preference';
	import { Img, type ImgSrc } from 'svelte-remote-image';

	export let url: URL;

	const { href: src, pathname } = url;

	let imageSrc: ImgSrc = {
		img: `${$imageOptimization}width=800,quality=60,format=webp/${src}`,
		fallback: [src]
	};
</script>

<span class="img-wrapper">
	{#if $imageOptimization && /\.(avif|jpg|jpeg|png|webp)$/i.test(pathname) && !src.startsWith($imageOptimization)}
		<Img class="global-content-image" src={imageSrc} alt={src} />
	{:else}
		<img class="global-content-image" {src} alt={src} />
	{/if}
</span>

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
