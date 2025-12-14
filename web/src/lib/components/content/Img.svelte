<script lang="ts">
	import { followees } from '$lib/stores/Author';
	import { imageOptimization } from '$lib/stores/Preference';
	import type { Event } from 'nostr-typedef';
	import { getContext } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { Img, type ImgSrc } from 'svelte-remote-image';
	import { onMount } from 'svelte';

	export let url: URL;

	const { href: src, pathname } = url;
	const events = getContext<Event[] | undefined>('events');
	const blur = events !== undefined && !events.some((event) => $followees.includes(event.pubkey));

	let imageSrc: ImgSrc = {
		img: `${$imageOptimization}width=800,quality=60,format=webp/${src}`,
		fallback: [src]
	};

	let imgElement: HTMLElement;

	onMount(async () => {
		if (/\.gif$/i.test(pathname) && imgElement) {
			const FreezeFrame = (await import('freezeframe')).default;
			new FreezeFrame(imgElement, {
				trigger: 'hover',
				overlay: true,
				responsive: true
			});
		}
	});
</script>

<span class="img-wrapper" class:blur>
	{#if $imageOptimization && /\.(avif|jpg|jpeg|png|webp)$/i.test(pathname) && !src.startsWith($imageOptimization)}
		<Img class="global-content-image{blur ? ' blur' : ''}" src={imageSrc} alt={src} />
	{:else}
		<img bind:this={imgElement} class="global-content-image" {src} alt={src} />
	{/if}
	{#if blur}
		<button>{$_('content.show')}</button>
	{/if}
</span>

<style>
	.img-wrapper :global(.global-content-image),
	.img-wrapper :global(.ff-canvas),
	.img-wrapper img {
		max-width: calc(100% - 1.5em);
		max-height: 20em;
		margin: 0.5em;
		border: 1px solid lightgray;
		border-radius: 5px;
		vertical-align: middle;
	}

	.img-wrapper.blur :global(.global-content-image.blur),
	.img-wrapper.blur :global(.ff-canvas),
	.img-wrapper.blur img {
		filter: blur(8px);
	}

	.img-wrapper {
		position: relative;
	}

	.img-wrapper :global(.ff-container) {
		display: inline-block;
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
