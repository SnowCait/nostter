<script lang="ts">
	import { imageOptimazerUrl } from '$lib/Constants';
	import { imageOptimization } from '$lib/stores/Preference';
	import { Img, type ImgSrc } from 'svelte-remote-image';

	export let url: URL;

	const { href: src, pathname } = url;

	let imageSrc: ImgSrc = {
		img: `${imageOptimazerUrl}width=800,quality=60,format=webp/${src}`,
		fallback: [src]
	};
</script>

<div class="img-wrapper">
	{#if $imageOptimization && /\.(avif|jpg|jpeg|png|webp)$/i.test(pathname) && !src.startsWith(imageOptimazerUrl)}
	<Img src={imageSrc} alt={src} />
	{:else}
	<img {src} alt={src} />
	{/if}
</div>

<style>
	.img-wrapper :global(img){
			max-width: calc(100% - 1.5em);
			max-height: 20em;
			margin:  0.5em;
			border: 1px solid lightgray;
			border-radius: 5px;
			vertical-align: middle;
	}
</style>