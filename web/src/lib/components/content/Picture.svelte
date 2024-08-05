<script lang="ts">
	import { imageOptimazerUrl } from '$lib/Constants';
	import { newUrl } from '$lib/Helper';
	import { robohash } from '$lib/Items';
	import { Img, type ImgSrc } from 'svelte-remote-image';
	export let src: string | undefined = undefined;
	export let pubkey: string;
	export let style = '';
	export let alt = '';
	export let title = '';
	export let size: string = 'm';

	const pictureSizeMap: Record<string, number> = {
		s: 40,
		m: 120,
		l: 320
	};

	const sizeNum = pictureSizeMap[size] ?? pictureSizeMap['m'];

	$: imgSrc = getImageSrc(src);

	function getImageSrc(src: string | undefined): ImgSrc {
		const url = src ? newUrl(src) : undefined;

		if (!url) {
			return {
				img: robohash(pubkey),
				fallback: [robohash(pubkey)]
			} as ImgSrc;
		} else if (/\.(avif|jpg|jpeg|png|webp)$/i.test(url.pathname)) {
			return {
				img: `${imageOptimazerUrl}width=${sizeNum},quality=60,format=jpeg/${src}`,
				srssets: [
					{
						src: `${imageOptimazerUrl}width=${sizeNum},quality=60,format=webp/${src}`,
						w: sizeNum
					}
				],
				fallback: [src, robohash(pubkey)],
				blur: false
			} as ImgSrc;
		} else {
			return {
				img: src,
				fallback: [robohash(pubkey)]
			} as ImgSrc;
		}
	}
</script>

<Img src={imgSrc} {alt} {title} {style} />
