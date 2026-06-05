const timelineScrollToTopEvent = 'nostter:timeline-scroll-to-top';

const defaultScrollTimeoutMs = 900;
const defaultCorrectionThresholdPx = 1;
const defaultMaxSmoothScrollDistancePx = 4000;

let scrollWindowToTopInFlight: Promise<void> | undefined;

type TimelineScrollToTopDetail = {
	target: string;
};

type ScrollWindowToTopOnceOptions = {
	prepare?: () => void | Promise<void>;
	afterScroll?: () => void | Promise<void>;
	timeoutMs?: number;
	correctionThresholdPx?: number;
	maxSmoothScrollDistancePx?: number;
};

export function requestTimelineScrollToTop(target: string): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	return !window.dispatchEvent(
		new CustomEvent<TimelineScrollToTopDetail>(timelineScrollToTopEvent, {
			detail: { target },
			cancelable: true
		})
	);
}

export function onTimelineScrollToTop(
	target: string,
	handler: () => void | Promise<void>
): () => void {
	if (typeof window === 'undefined') {
		return () => {};
	}
	const listener = (event: Event) => {
		const detail = event instanceof CustomEvent ? event.detail : undefined;
		if ((detail as TimelineScrollToTopDetail | undefined)?.target !== target) {
			return;
		}

		event.preventDefault();
		void handler();
	};
	window.addEventListener(timelineScrollToTopEvent, listener);
	return () => window.removeEventListener(timelineScrollToTopEvent, listener);
}

export function scrollWindowToTopOnce(options: ScrollWindowToTopOnceOptions = {}): Promise<void> {
	if (typeof window === 'undefined') {
		return Promise.resolve();
	}

	if (scrollWindowToTopInFlight !== undefined) {
		return scrollWindowToTopInFlight;
	}

	scrollWindowToTopInFlight = scrollWindowToTopOnceInternal(options).finally(() => {
		scrollWindowToTopInFlight = undefined;
	});

	return scrollWindowToTopInFlight;
}

async function scrollWindowToTopOnceInternal({
	prepare,
	afterScroll,
	timeoutMs = defaultScrollTimeoutMs,
	correctionThresholdPx = defaultCorrectionThresholdPx,
	maxSmoothScrollDistancePx = defaultMaxSmoothScrollDistancePx
}: ScrollWindowToTopOnceOptions): Promise<void> {
	const preparation = prepare?.();
	if (preparation !== undefined) {
		await preparation;
	}

	const behavior = getPreferredScrollBehavior(maxSmoothScrollDistancePx);

	window.scrollTo({
		top: 0,
		behavior
	});

	if (behavior === 'smooth') {
		await waitUntilWindowNearTop(timeoutMs, correctionThresholdPx);
	}

	correctWindowScrollToTop(correctionThresholdPx);

	const afterScrollOperation = afterScroll?.();
	if (afterScrollOperation !== undefined) {
		await afterScrollOperation;
	}

	correctWindowScrollToTop(correctionThresholdPx);
}

function getPreferredScrollBehavior(maxSmoothScrollDistancePx: number): ScrollBehavior {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		return 'auto';
	}

	return window.scrollY > maxSmoothScrollDistancePx ? 'auto' : 'smooth';
}

function correctWindowScrollToTop(thresholdPx: number): void {
	if (window.scrollY <= thresholdPx) {
		return;
	}

	window.scrollTo({
		top: 0,
		behavior: 'auto'
	});
}

function waitUntilWindowNearTop(timeoutMs: number, thresholdPx: number): Promise<void> {
	return new Promise((resolve) => {
		const startedAt = performance.now();

		const step = () => {
			if (window.scrollY <= thresholdPx || performance.now() - startedAt >= timeoutMs) {
				resolve();
				return;
			}

			window.requestAnimationFrame(step);
		};

		window.requestAnimationFrame(step);
	});
}
