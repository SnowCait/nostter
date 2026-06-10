<script lang="ts">
	import { followees } from '$lib/stores/Author';
	import { gifAutoplay, imageOptimization } from '$lib/stores/Preference';
	import type * as Nostr from 'nostr-typedef';
	import { getContext } from 'svelte';
	import { _ } from 'svelte-i18n';

	interface Props {
		url: URL;
	}

	let { url }: Props = $props();

	const { href: src, pathname } = $derived(url);
	const events = getContext<Nostr.Event[] | undefined>('events');
	const blur = events !== undefined && !events.some((event) => $followees.includes(event.pubkey));

	const optimize = $derived(
		$imageOptimization !== '' &&
			/\.(avif|jpg|jpeg|png|webp)$/i.test(pathname) &&
			!src.startsWith($imageOptimization)
	);

	// Writable $derived: reassigned on error/load, reset when url or preference changes
	let displaySrc = $derived(
		optimize ? `${$imageOptimization}width=800,quality=60,format=webp/${src}` : src
	);
	let loading = $derived(optimize);

	const animated = $derived(/\.(gif|apng)$/i.test(pathname));
	let playing = $state(false);
	const frozen = $derived(animated && !$gifAutoplay && !playing);

	let img = $state<HTMLImageElement>();
	let canvas = $state<HTMLCanvasElement>();
	let canvasDrawn = $state(false);

	function freeze(): void {
		if (img === undefined || canvas === undefined || !img.complete || img.naturalWidth === 0) {
			return;
		}
		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;
		// drawImage renders the first frame; the canvas gets tainted but pixels are never read back
		canvas.getContext('2d')?.drawImage(img, 0, 0);
		canvasDrawn = true;
	}

	// Fallback for images already complete before onload fires (cache) and for preference toggles
	$effect(() => {
		if (frozen) {
			if (!canvasDrawn) {
				freeze();
			}
		} else {
			canvasDrawn = false;
		}
	});

	function play(event: MouseEvent): void {
		// Do not bubble to the gallery dialog trigger in Thumbnail.svelte
		event.preventDefault();
		event.stopPropagation();
		playing = true;
	}
</script>

<span class="img-wrapper">
	<img
		bind:this={img}
		class:blur
		class:loading
		class:frozen={frozen && canvasDrawn}
		src={displaySrc}
		alt={src}
		loading="lazy"
		onload={() => {
			loading = false;
			if (frozen) {
				freeze();
			}
		}}
		onerror={() => {
			if (displaySrc !== src) {
				displaySrc = src;
			} else {
				loading = false;
			}
		}}
	/>
	{#if frozen}
		<canvas bind:this={canvas} class:blur class:pending={!canvasDrawn}></canvas>
		{#if canvasDrawn}
			<button class="gif-badge" onclick={play}>GIF</button>
		{/if}
	{/if}
	{#if blur}
		<button class="show">{$_('content.show')}</button>
	{/if}
</span>

<style>
	img,
	canvas {
		max-width: calc(100% - 1.5em);
		max-height: 20em;
		margin: 0.5em;
		border: 1px solid lightgray;
		border-radius: 5px;
	}

	img.blur,
	canvas.blur {
		filter: blur(8px);
	}

	img.loading {
		opacity: 0;
	}

	img.frozen,
	canvas.pending {
		display: none;
	}

	.img-wrapper {
		display: inline-grid;
		place-items: center;
		vertical-align: middle;
	}

	/* Stack all children in the same cell so buttons overlay the image */
	.img-wrapper > * {
		grid-area: 1 / 1;
	}

	/* Blur's filter creates a stacking context that would otherwise paint over the buttons */
	.img-wrapper > button {
		z-index: 1;
	}

	/* Paint above the blur filter's stacking context */
	.img-wrapper > button {
		z-index: 1;
	}

	button:hover {
		opacity: inherit;
	}

	button.gif-badge {
		align-self: end;
		justify-self: start;
		margin: 1em;
		padding: 0.1em 0.5em;
		font-weight: bold;
		color: white;
		background: rgb(0 0 0 / 0.6);
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}
</style>
