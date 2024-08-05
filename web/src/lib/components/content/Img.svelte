<script lang="ts">
	import { imageOptimazerUrl } from '$lib/Constants';
	import { formatStyleFromObject } from '$lib/styles/FormatStyleFromObject';
	import { Img, type ImgSrc } from 'svelte-remote-image';
	export let src: string;
	export let pathname: string;

	const imgStyleObj = {
		'max-width': 'calc(100% - 1.5em)',
		'max-height': '20em',
		margin: ' 0.5em',
		border: '1px solid lightgray',
		'border-radius': '5px',
		'vertical-align': 'middle'
	};

	let imageSrc: ImgSrc = {
		img: `${imageOptimazerUrl}width=800,quality=60,format=jpeg/${src}`,
		srcsets: [
			{ src: `${imageOptimazerUrl}width=800,quality=60,format=webp/${src}`, w: 800 },
			{ src: `${imageOptimazerUrl}width=400,quality=60,format=webp/${src}`, w: 400 }
		],
		fallback: [src]
	};
</script>

{#if /\.(avif|jpg|jpeg|png|webp)$/i.test(pathname)}
	<Img src={imageSrc} alt={src} style={formatStyleFromObject(imgStyleObj)} />
{:else if /\.(apng|gif|bmp)$/i.test(pathname)}
	<img style={formatStyleFromObject(imgStyleObj)} {src} alt={src} />
{/if}
