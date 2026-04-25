import { drawStillFrame, revokeObjectImageSrc } from './FreezeframeImage';

type FreezeframeImageStateOptions = {
	canvas: () => HTMLCanvasElement | undefined;
	src: () => string;
};

type FreezeframeImageState = {
	ready: boolean;
	failed: boolean;
	playing: boolean;
	playerSrc: string | undefined;
	touchControl: boolean;
	pointerEnter(event: PointerEvent): void;
	pointerLeave(event: PointerEvent): void;
	controlPointerDown(event: PointerEvent): void;
	controlClick(event: MouseEvent): void;
	controlKeydown(event: KeyboardEvent): void;
};

export function createFreezeframeImageState(
	options: FreezeframeImageStateOptions
): FreezeframeImageState {
	let drawToken = 0;
	let pointerType = '';
	let objectUrl: string | undefined;

	const state = $state<FreezeframeImageState>({
		ready: false,
		failed: false,
		playing: false,
		playerSrc: undefined,
		touchControl: false,
		pointerEnter,
		pointerLeave,
		controlPointerDown,
		controlClick,
		controlKeydown
	});

	function setPlayerSrc(src: string | undefined): void {
		if (objectUrl !== undefined && objectUrl !== src) {
			revokeObjectImageSrc(objectUrl);
			objectUrl = undefined;
		}

		if (src?.startsWith('blob:')) {
			objectUrl = src;
		}

		state.playerSrc = src;
	}

	function reset(): void {
		state.ready = false;
		state.failed = false;
		state.playing = false;
		state.touchControl = false;
		setPlayerSrc(undefined);
	}

	async function loadStillFrame(
		element: HTMLCanvasElement,
		src: string,
		token: number
	): Promise<void> {
		reset();

		const nextPlayerSrc = await drawStillFrame(element, src);
		if (token === drawToken) {
			setPlayerSrc(nextPlayerSrc);
			state.ready = true;
		} else {
			revokeObjectImageSrc(nextPlayerSrc);
		}
	}

	function play(): void {
		if (state.ready && !state.failed) {
			state.playing = true;
		}
	}

	function stop(): void {
		state.playing = false;
	}

	function toggle(): void {
		if (state.ready && !state.failed) {
			state.playing = !state.playing;
		}
	}

	function pointerEnter(event: PointerEvent): void {
		if (event.pointerType === 'mouse') {
			state.touchControl = false;
			play();
		}
	}

	function pointerLeave(event: PointerEvent): void {
		if (event.pointerType === 'mouse') {
			stop();
		}
	}

	function controlPointerDown(event: PointerEvent): void {
		pointerType = event.pointerType;
		if (event.pointerType !== 'mouse') {
			state.touchControl = true;
		}
	}

	function controlClick(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		if (pointerType === 'mouse') {
			state.touchControl = false;
		}
		toggle();
	}

	function controlKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			event.stopPropagation();
			state.touchControl = true;
			toggle();
		}
	}

	$effect(() => {
		const element = options.canvas();
		const src = options.src();
		if (element === undefined) {
			return;
		}

		const token = ++drawToken;
		loadStillFrame(element, src, token).catch((error) => {
			if (token === drawToken) {
				console.warn('[freezeframe image]', src, error);
				state.failed = true;
				state.ready = false;
				state.playing = false;
			}
		});

		return () => {
			drawToken++;
			setPlayerSrc(undefined);
		};
	});

	return state;
}
