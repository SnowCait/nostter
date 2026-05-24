const timelineScrollToTopEvent = 'nostter:timeline-scroll-to-top';

type TimelineScrollToTopDetail = {
	target: string;
};

export function requestTimelineScrollToTop(target: string): void {
	if (typeof window === 'undefined') {
		return;
	}
	window.dispatchEvent(
		new CustomEvent<TimelineScrollToTopDetail>(timelineScrollToTopEvent, {
			detail: { target }
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

		void handler();
	};
	window.addEventListener(timelineScrollToTopEvent, listener);
	return () => window.removeEventListener(timelineScrollToTopEvent, listener);
}
