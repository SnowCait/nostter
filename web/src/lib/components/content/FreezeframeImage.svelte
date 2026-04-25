<script lang="ts">
	import { createFreezeframeImageState } from '$lib/media/FreezeframeImageState.svelte';

	interface Props {
		src: string;
		alt: string;
		blur?: boolean;
	}

	let { src, alt, blur = false }: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	const freezeframe = createFreezeframeImageState({
		canvas: () => canvas,
		src: () => src
	});
</script>

<span
	class="freezeframe-image"
	onpointerenter={freezeframe.pointerEnter}
	onpointerleave={freezeframe.pointerLeave}
	role="group"
	aria-label={alt}
>
	<canvas
		class="global-content-image freezeframe-canvas"
		class:playing={freezeframe.playing}
		class:blur
		hidden={freezeframe.failed}
		bind:this={canvas}
		aria-hidden="true"
	></canvas>
	{#if freezeframe.failed}
		<img class="global-content-image" class:blur {src} alt="" aria-hidden="true" />
	{:else if freezeframe.playerSrc !== undefined}
		<img
			class="global-content-image freezeframe-player"
			class:playing={freezeframe.playing}
			class:blur
			src={freezeframe.playerSrc}
			alt=""
			aria-hidden="true"
		/>
	{/if}
	{#if freezeframe.ready && !freezeframe.failed && (!freezeframe.playing || freezeframe.touchControl)}
		<span
			class="freezeframe-control"
			class:playing={freezeframe.playing}
			onpointerdown={freezeframe.controlPointerDown}
			onclick={freezeframe.controlClick}
			onkeydown={freezeframe.controlKeydown}
			role="button"
			tabindex="0"
			aria-label={freezeframe.playing ? 'Stop animation' : 'Play animation'}
			aria-pressed={freezeframe.playing}
		></span>
	{/if}
</span>

<style>
	.freezeframe-image {
		position: relative;
		display: inline-grid;
		grid-template-areas: 'image';
		max-width: 100%;
		line-height: 0;
		vertical-align: middle;
	}

	.freezeframe-canvas,
	.freezeframe-player {
		grid-area: image;
	}

	.freezeframe-canvas {
		display: block;
		box-sizing: border-box;
		object-fit: contain;
	}

	.freezeframe-canvas.playing {
		opacity: 0;
	}

	.freezeframe-player {
		display: block;
		box-sizing: border-box;
		object-fit: contain;
		opacity: 0;
		pointer-events: none;
	}

	.freezeframe-image .freezeframe-player {
		border-color: transparent;
	}

	.freezeframe-player.playing {
		opacity: 1;
	}

	.freezeframe-image .freezeframe-player.playing {
		border-color: lightgray;
	}

	.freezeframe-control {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 3em;
		height: 3em;
		transform: translate(-50%, -50%);
		border: 1px solid rgb(255 255 255 / 80%);
		border-radius: 50%;
		background: rgb(0 0 0 / 55%);
		box-shadow: 0 2px 8px rgb(0 0 0 / 25%);
		cursor: pointer;
	}

	.freezeframe-control::before {
		position: absolute;
		top: 50%;
		left: 54%;
		width: 0;
		height: 0;
		transform: translate(-50%, -50%);
		border-top: 0.65em solid transparent;
		border-bottom: 0.65em solid transparent;
		border-left: 1em solid white;
		content: '';
	}

	.freezeframe-control.playing::before,
	.freezeframe-control.playing::after {
		top: 50%;
		width: 0.35em;
		height: 1.25em;
		transform: translateY(-50%);
		border: 0;
		background: white;
	}

	.freezeframe-control.playing::before {
		left: 36%;
	}

	.freezeframe-control.playing::after {
		position: absolute;
		left: 56%;
		content: '';
	}
</style>
