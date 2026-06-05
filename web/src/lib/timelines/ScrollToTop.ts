const timelineScrollToTopEvent = 'nostter:timeline-scroll-to-top';

const defaultScrollTimeoutMs = 900;
const defaultCorrectionThresholdPx = 1;
const defaultMaxSmoothScrollDistancePx = 4000;

let scrollWindowToTopInFlight: Promise<void> | undefined;

type TimelineScrollToTopDetail = {
	target: string;
	handled: boolean;
};

type ScrollWindowToTopOnceOptions = {
	/**
	 * Runs before the scroll starts. Only the first call's callback runs while a scroll is
	 * already in flight; later calls are coalesced into that same operation.
	 */
	prepare?: () => void | Promise<void>;
	/**
	 * Runs once after the window reaches the top. This is useful for timeline DOM
	 * pruning that would otherwise cause scroll anchoring/layout shifts at the start
	 * of the animation. Only the first call's callback runs while coalescing.
	 */
	afterScroll?: () => void | Promise<void>;
	timeoutMs?: number;
	correctionThresholdPx?: number;
	maxSmoothScrollDistancePx?: number;
};

export function requestTimelineScrollToTop(target: string): boolean {
	if (typeof window === 'undefined') {
		return false;
	}

	const detail: TimelineScrollToTopDetail = { target, handled: false };
	window.dispatchEvent(
		new CustomEvent<TimelineScrollToTopDetail>(timelineScrollToTopEvent, {
			detail
		})
	);
	return detail.handled;
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
		const timelineScrollToTopDetail = detail as TimelineScrollToTopDetail | undefined;
		if (timelineScrollToTopDetail?.target !== target) {
			return;
		}

		try {
			const result = handler();
			timelineScrollToTopDetail.handled = true;
			void Promise.resolve(result).catch(reportTimelineScrollToTopError);
		} catch (error) {
			reportTimelineScrollToTopError(error);
		}
	};
	window.addEventListener(timelineScrollToTopEvent, listener);
	return () => window.removeEventListener(timelineScrollToTopEvent, listener);
}

function reportTimelineScrollToTopError(error: unknown): void {
	console.error('[timeline scroll-to-top]', error);
}

/**
 * Starts one window scroll-to-top operation at a time. Calls made while another
 * operation is in flight return the same promise and intentionally keep the first
 * call's options. This prevents repeated UI input from queuing extra scrolls or
 * duplicate timeline mutations.
 */
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
