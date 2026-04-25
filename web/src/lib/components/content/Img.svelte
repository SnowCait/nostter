<script lang="ts">
	import { getAnimatedImageType } from '$lib/media/AnimatedImage';
	import { createAnimatedImageState } from '$lib/media/AnimatedImageState.svelte';
	import { followees } from '$lib/stores/Author';
	import { enableAutoPlayAnimatedImages, imageOptimization } from '$lib/stores/Preference';
	import type { Event } from 'nostr-typedef';
	import { getContext } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { Img, type ImgSrc } from 'svelte-remote-image';
	import FreezeframeImage from './FreezeframeImage.svelte';

	interface Props {
		url: URL;
		mimeType?: string | null;
	}

	let { url, mimeType = undefined }: Props = $props();

	const { href: src, pathname } = $derived(url);
	const animatedImageType = $derived(getAnimatedImageType(mimeType, pathname));
	const animatedImage = createAnimatedImageState({
		src: () => src,
		type: () => animatedImageType,
		autoPlay: () => $enableAutoPlayAnimatedImages
	});
	const events = getContext<Event[] | undefined>('events');
	const blur = events !== undefined && !events.some((event) => $followees.includes(event.pubkey));

	let imageSrc: ImgSrc = $derived({
		img: `${$imageOptimization}width=800,quality=60,format=webp/${src}`,
		fallback: [src]
	});
</script>

<span class="img-wrapper">
	{#if !$enableAutoPlayAnimatedImages && animatedImage.animated}
		<FreezeframeImage {src} alt={src} {blur} />
	{:else if !$enableAutoPlayAnimatedImages && animatedImage.checking}
		<span class="global-content-image animated-image-checking"></span>
	{:else if $imageOptimization && /\.(avif|jpg|jpeg|png|webp)$/i.test(pathname) && !src.startsWith($imageOptimization)}
		<Img class="global-content-image{blur ? ' blur' : ''}" src={imageSrc} alt={src} />
	{:else}
		<img class="global-content-image" class:blur {src} alt={src} />
	{/if}
	{#if blur}
		<button>{$_('content.show')}</button>
	{/if}
</span>

<style>
	.img-wrapper :global(.global-content-image) {
		max-width: calc(100% - 1.5em);
		max-height: 20em;
		margin: 0.5em;
		border: 1px solid lightgray;
		border-radius: 5px;
		box-sizing: border-box;
		vertical-align: middle;
	}

	.img-wrapper :global(.global-content-image.animated-image-checking) {
		display: inline-block;
		width: min(16em, calc(100% - 1.5em));
		height: 10em;
		background: var(--accent-surface-low);
	}

	.img-wrapper :global(.global-content-image.blur),
	img.blur {
		filter: blur(8px);
	}

	.img-wrapper {
		position: relative;
	}

	button {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	button:hover {
		opacity: inherit;
	}
</style>
