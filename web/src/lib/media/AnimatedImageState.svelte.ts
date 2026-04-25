import { detectAnimatedImage, type AnimatedImageType } from './AnimatedImage';

type AnimatedImageStateOptions = {
	src: () => string;
	type: () => AnimatedImageType | undefined;
	autoPlay: () => boolean;
};

type AnimatedImageState = {
	animated: boolean;
	checking: boolean;
};

export function createAnimatedImageState(options: AnimatedImageStateOptions): AnimatedImageState {
	const state = $state({
		animated: false,
		checking: false
	});

	$effect(() => {
		const src = options.src();
		const type = options.type();
		if (options.autoPlay() || type === undefined) {
			state.animated = false;
			state.checking = false;
			return;
		}

		let cancelled = false;
		state.animated = false;
		state.checking = true;
		detectAnimatedImage(src, type)
			.then((animated) => {
				if (!cancelled) {
					state.animated = animated;
				}
			})
			.catch((error) => {
				if (!cancelled) {
					console.warn('[detect animated image]', src, error);
					state.animated = true;
				}
			})
			.finally(() => {
				if (!cancelled) {
					state.checking = false;
				}
			});

		return () => {
			cancelled = true;
		};
	});

	return state;
}
