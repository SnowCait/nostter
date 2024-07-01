<script lang="ts">
	import { imageOptimazerUrl } from '$lib/Constants';
	import { robohash } from '$lib/Items';
	import { formatStyleFromObject } from '$lib/styles/FormatStyleFromObject';
	import { Image, type ImageSrc } from 'svelte-remote-image';
	export let src: string | undefined = undefined;
	export let pubkey: string;
	export let style = {};

	$: imageSrc = !src
		? {
				img: robohash(pubkey),
				failback: robohash(pubkey),
				alt: ''
		  }
		: ({
				img: `${imageOptimazerUrl}width=120,quality=60,format=webp/${src}`,
				webp: [
					{ src: `${imageOptimazerUrl}width=120,quality=60,format=webp/${src}`, w: 120 }
				],
				jpeg: [
					{ src: `${imageOptimazerUrl}width=120,quality=60,format=jpeg/${src}`, w: 120 }
				],
				failback: src,
				alt: '',
				blur: false
		  } as ImageSrc);
</script>

<Image src={imageSrc} style={formatStyleFromObject(style)} />
