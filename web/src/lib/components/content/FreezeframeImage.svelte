<script lang="ts">
	interface Props {
		src: string;
		alt: string;
		blur?: boolean;
	}

	let { src, alt, blur = false }: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let ready = $state(false);
	let failed = $state(false);
	let playing = $state(false);
	let playerSrc: string | undefined = $state();
	let drawToken = 0;
	let pointerType = '';
	let touchControl = $state(false);
	let objectUrl: string | undefined;

	function drawToCanvas(
		element: HTMLCanvasElement,
		image: CanvasImageSource,
		width: number,
		height: number
	): void {
		if (width === 0 || height === 0) {
			throw new Error('Image has no dimensions.');
		}

		const context = element.getContext('2d');
		if (context === null) {
			throw new Error('Canvas 2D context is not available.');
		}

		element.width = width;
		element.height = height;
		context.clearRect(0, 0, width, height);
		context.drawImage(image, 0, 0, width, height);
	}

	function setPlayerSrc(src: string | undefined) {
		if (objectUrl !== undefined && objectUrl !== src) {
			URL.revokeObjectURL(objectUrl);
			objectUrl = undefined;
		}

		if (src?.startsWith('blob:')) {
			objectUrl = src;
		}

		playerSrc = src;
	}

	async function drawBlobFrame(element: HTMLCanvasElement, imageSrc: string): Promise<string> {
		const response = await fetch(imageSrc);
		if (!response.ok) {
			throw new Error(`Failed to fetch image: ${response.status}`);
		}

		const blob = await response.blob();
		const url = URL.createObjectURL(blob);
		try {
			if (typeof createImageBitmap === 'function') {
				const bitmap = await createImageBitmap(blob);
				try {
					drawToCanvas(element, bitmap, bitmap.width, bitmap.height);
				} finally {
					bitmap.close();
				}
			} else {
				await drawImageElement(element, url);
			}
		} catch (error) {
			URL.revokeObjectURL(url);
			throw error;
		}

		return url;
	}

	async function drawImageElement(element: HTMLCanvasElement, imageSrc: string): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			const image = new Image();
			image.decoding = 'sync';
			image.onload = () => {
				try {
					drawToCanvas(element, image, image.naturalWidth, image.naturalHeight);
					resolve();
				} catch (error) {
					reject(error);
				}
			};
			image.onerror = () => {
				reject(new Error('Failed to load image.'));
			};
			image.src = imageSrc;
		});
	}

	async function drawStillFrame(element: HTMLCanvasElement, imageSrc: string, token: number) {
		ready = false;
		failed = false;
		playing = false;
		touchControl = false;
		setPlayerSrc(undefined);

		let nextPlayerSrc: string | undefined;
		try {
			nextPlayerSrc = await drawBlobFrame(element, imageSrc);
		} catch {
			await drawImageElement(element, imageSrc);
			nextPlayerSrc = imageSrc;
		}

		if (token === drawToken) {
			setPlayerSrc(nextPlayerSrc);
			ready = true;
		} else if (nextPlayerSrc?.startsWith('blob:')) {
			URL.revokeObjectURL(nextPlayerSrc);
		}
	}

	function play() {
		if (ready && !failed) {
			playing = true;
		}
	}

	function stop() {
		playing = false;
	}

	function toggle() {
		if (ready && !failed) {
			playing = !playing;
		}
	}

	function pointerEnter(event: PointerEvent) {
		if (event.pointerType === 'mouse') {
			touchControl = false;
			play();
		}
	}

	function pointerLeave(event: PointerEvent) {
		if (event.pointerType === 'mouse') {
			stop();
		}
	}

	function controlPointerDown(event: PointerEvent) {
		pointerType = event.pointerType;
		if (event.pointerType !== 'mouse') {
			touchControl = true;
		}
	}

	function controlClick(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (pointerType === 'mouse') {
			touchControl = false;
		}
		toggle();
	}

	function controlKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			event.stopPropagation();
			touchControl = true;
			toggle();
		}
	}

	$effect(() => {
		const element = canvas;
		const imageSrc = src;
		if (element === undefined) {
			return;
		}

		const token = ++drawToken;
		drawStillFrame(element, imageSrc, token).catch((error) => {
			if (token === drawToken) {
				console.warn('[freezeframe image]', imageSrc, error);
				failed = true;
				ready = false;
				playing = false;
			}
		});

		return () => {
			drawToken++;
			setPlayerSrc(undefined);
		};
	});
</script>

<span
	class="freezeframe-image"
	onpointerenter={pointerEnter}
	onpointerleave={pointerLeave}
	role="group"
	aria-label={alt}
>
	<canvas
		class="global-content-image freezeframe-canvas"
		class:blur
		hidden={failed}
		bind:this={canvas}
		aria-hidden="true"
	></canvas>
	{#if failed}
		<img class="global-content-image" class:blur {src} alt="" aria-hidden="true" />
	{:else if playerSrc !== undefined}
		<img
			class="global-content-image freezeframe-player"
			class:playing
			class:blur
			src={playerSrc}
			alt=""
			aria-hidden="true"
		/>
	{/if}
	{#if ready && !failed && (!playing || touchControl)}
		<span
			class="freezeframe-control"
			class:playing
			onpointerdown={controlPointerDown}
			onclick={controlClick}
			onkeydown={controlKeydown}
			role="button"
			tabindex="0"
			aria-label={playing ? 'Stop animation' : 'Play animation'}
			aria-pressed={playing}
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
