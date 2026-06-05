const timelineScrollToTopEvent = 'nostter:timeline-scroll-to-top';

const defaultScrollTimeoutMs = 900;
const defaultCorrectionThresholdPx = 1;
const defaultMaxSmoothScrollDistancePx = 4000;

let scrollWindowToTopInFlight: Promise<void> | undefined;

type TimelineScrollToTopDetail = {
	target: string;
	accepted: boolean;
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

/**
 * Dispatches a target-specific timeline scroll-to-top request.
 *
 * Returns true when a matching timeline listener accepts the request by invoking
 * its handler without throwing synchronously. It does not mean that the async
 * scroll operation has completed or cannot fail later.
 */
export function requestTimelineScrollToTop(target: string): boolean {
	if (typeof window === 'undefined') {
		return false;
	}

	const detail: TimelineScrollToTopDetail = { target, accepted: false };
	window.dispatchEvent(
		new CustomEvent<TimelineScrollToTopDetail>(timelineScrollToTopEvent, {
			detail
		})
	);
	return detail.accepted;
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
			timelineScrollToTopDetail.accepted = true;
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

function reportWindowScrollToTopError(error: unknown): void {
	console.error('[window scroll-to-top]', error);
}

/**
 * Starts one window scroll-to-top operation at a time. Calls made while another
 * operation is in flight return the same promise and intentionally keep the first
 * call's options. This prevents repeated UI input from queuing extra scrolls or
 * duplicate timeline mutations.
 *
 * The returned promise does not reject. Scroll-to-top is a best-effort UI action;
 * failures are logged and the in-flight guard is cleared so future requests can
 * still run.
 */
export function scrollWindowToTopOnce(options: ScrollWindowToTopOnceOptions = {}): Promise<void> {
	if (typeof window === 'undefined') {
		return Promise.resolve();
	}

	if (scrollWindowToTopInFlight !== undefined) {
		return scrollWindowToTopInFlight;
	}

	scrollWindowToTopInFlight = scrollWindowToTopOnceInternal(options)
		.catch(reportWindowScrollToTopError)
		.finally(() => {
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

	try {
		const afterScrollOperation = afterScroll?.();
		if (afterScrollOperation !== undefined) {
			await afterScrollOperation;
		}
	} finally {
		correctWindowScrollToTop(correctionThresholdPx);
	}
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
		let resolved = false;
		const startedAt = performance.now();

		const finish = () => {
			if (resolved) {
				return;
			}

			resolved = true;
			clearTimeout(timeoutId);
			resolve();
		};

		const step = () => {
			if (resolved) {
				return;
			}

			if (window.scrollY <= thresholdPx || performance.now() - startedAt >= timeoutMs) {
				finish();
				return;
			}

			window.requestAnimationFrame(step);
		};

		const timeoutId = setTimeout(finish, timeoutMs);
		window.requestAnimationFrame(step);
	});
}
