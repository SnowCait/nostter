import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	onTimelineScrollToTop,
	requestTimelineScrollToTop,
	scrollWindowToTopOnce
} from './ScrollToTop';

function installTimelineEventWindowMock(): void {
	vi.stubGlobal('window', new EventTarget() as Window & typeof globalThis);

	if (typeof CustomEvent === 'undefined') {
		class TestCustomEvent<T = unknown> extends Event {
			readonly detail: T;

			constructor(type: string, eventInitDict?: CustomEventInit<T>) {
				super(type, eventInitDict);
				this.detail = eventInitDict?.detail as T;
			}
		}

		vi.stubGlobal('CustomEvent', TestCustomEvent);
	}
}

function installWindowMock(options: { reducedMotion?: boolean; initialScrollY?: number } = {}) {
	let scrollY = options.initialScrollY ?? 1000;
	let now = 0;
	const rafCallbacks: FrameRequestCallback[] = [];

	const scrollTo = vi.fn((scrollOptions: ScrollToOptions) => {
		if (scrollOptions.behavior === 'auto') {
			scrollY = Number(scrollOptions.top ?? 0);
		}
	});

	const windowMock = {
		get scrollY() {
			return scrollY;
		},
		scrollTo,
		matchMedia: vi.fn(
			() =>
				({
					matches: options.reducedMotion ?? false
				}) as MediaQueryList
		),
		requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
			rafCallbacks.push(callback);
			return rafCallbacks.length;
		})
	} as unknown as Window & typeof globalThis;

	vi.stubGlobal('window', windowMock);
	vi.stubGlobal('performance', {
		now: vi.fn(() => now)
	});

	return {
		windowMock,
		scrollTo,
		setScrollY(value: number) {
			scrollY = value;
		},
		setNow(value: number) {
			now = value;
		},
		flushRaf() {
			const callbacks = rafCallbacks.splice(0);
			for (const callback of callbacks) {
				callback(now);
			}
		}
	};
}

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('scrollWindowToTopOnce', () => {
	it('performs one smooth scroll by default', async () => {
		const browser = installWindowMock({ initialScrollY: 1000 });

		const operation = scrollWindowToTopOnce();

		expect(browser.scrollTo).toHaveBeenCalledTimes(1);
		expect(browser.scrollTo).toHaveBeenCalledWith({
			top: 0,
			behavior: 'smooth'
		});

		browser.setScrollY(0);
		browser.flushRaf();

		await operation;
		expect(browser.scrollTo).toHaveBeenCalledTimes(1);
	});

	it('coalesces repeated calls while a smooth scroll is in flight', async () => {
		const browser = installWindowMock({ initialScrollY: 1000 });

		const first = scrollWindowToTopOnce();
		const second = scrollWindowToTopOnce();

		expect(first).toBe(second);
		expect(browser.scrollTo).toHaveBeenCalledTimes(1);
		expect(browser.scrollTo).toHaveBeenCalledWith({
			top: 0,
			behavior: 'smooth'
		});

		browser.setScrollY(0);
		browser.flushRaf();

		await first;
	});

	it('keeps the first call options while coalescing', async () => {
		const browser = installWindowMock({ initialScrollY: 1000 });
		const firstAfterScroll = vi.fn();
		const secondAfterScroll = vi.fn();

		const first = scrollWindowToTopOnce({ afterScroll: firstAfterScroll });
		const second = scrollWindowToTopOnce({ afterScroll: secondAfterScroll });

		expect(first).toBe(second);

		browser.setScrollY(0);
		browser.flushRaf();
		await first;

		expect(firstAfterScroll).toHaveBeenCalledTimes(1);
		expect(secondAfterScroll).not.toHaveBeenCalled();
	});

	it('runs prepare only once during a burst', async () => {
		const browser = installWindowMock({ initialScrollY: 1000 });
		let resolvePrepare: (() => void) | undefined;
		const prepare = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolvePrepare = resolve;
				})
		);

		const first = scrollWindowToTopOnce({ prepare });
		const second = scrollWindowToTopOnce({ prepare });

		expect(first).toBe(second);
		expect(prepare).toHaveBeenCalledTimes(1);
		expect(browser.scrollTo).not.toHaveBeenCalled();

		resolvePrepare?.();
		await Promise.resolve();

		expect(browser.scrollTo).toHaveBeenCalledTimes(1);
		expect(browser.scrollTo).toHaveBeenCalledWith({
			top: 0,
			behavior: 'smooth'
		});

		browser.setScrollY(0);
		browser.flushRaf();

		await first;
	});

	it('logs prepare errors, resolves, and clears the in-flight guard', async () => {
		const browser = installWindowMock({ initialScrollY: 1000 });
		const error = new Error('prepare failed');
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(
			scrollWindowToTopOnce({
				prepare: () => {
					throw error;
				}
			})
		).resolves.toBeUndefined();

		expect(consoleError).toHaveBeenCalledWith('[window scroll-to-top]', error);
		expect(browser.scrollTo).not.toHaveBeenCalled();

		const later = scrollWindowToTopOnce();
		expect(browser.scrollTo).toHaveBeenCalledTimes(1);

		browser.setScrollY(0);
		browser.flushRaf();
		await later;
	});

	it('logs afterScroll errors, resolves, and performs final correction', async () => {
		const browser = installWindowMock({ initialScrollY: 1000 });
		const error = new Error('afterScroll failed');
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		const operation = scrollWindowToTopOnce({
			afterScroll: () => {
				browser.setScrollY(20);
				return Promise.reject(error);
			}
		});

		browser.setScrollY(0);
		browser.flushRaf();

		await expect(operation).resolves.toBeUndefined();

		expect(consoleError).toHaveBeenCalledWith('[window scroll-to-top]', error);
		expect(browser.scrollTo).toHaveBeenLastCalledWith({
			top: 0,
			behavior: 'auto'
		});
	});

	it('allows a later call after the in-flight operation completes', async () => {
		const browser = installWindowMock({ initialScrollY: 1000 });

		const first = scrollWindowToTopOnce();
		browser.setScrollY(0);
		browser.flushRaf();
		await first;

		browser.setScrollY(500);
		const second = scrollWindowToTopOnce();

		expect(browser.scrollTo).toHaveBeenCalledTimes(2);
		expect(browser.scrollTo).toHaveBeenLastCalledWith({
			top: 0,
			behavior: 'smooth'
		});

		browser.setScrollY(0);
		browser.flushRaf();
		await second;
	});

	it('runs afterScroll after the window reaches the top', async () => {
		const browser = installWindowMock({ initialScrollY: 1000 });
		const afterScroll = vi.fn(() => {
			expect(window.scrollY).toBe(0);
		});

		const operation = scrollWindowToTopOnce({ afterScroll });

		expect(afterScroll).not.toHaveBeenCalled();

		browser.setScrollY(0);
		browser.flushRaf();

		await operation;

		expect(afterScroll).toHaveBeenCalledTimes(1);
	});

	it('uses auto behavior for long-distance scrolls', async () => {
		const browser = installWindowMock({ initialScrollY: 5000 });

		await scrollWindowToTopOnce();

		expect(browser.scrollTo).toHaveBeenCalledTimes(1);
		expect(browser.scrollTo).toHaveBeenCalledWith({
			top: 0,
			behavior: 'auto'
		});
	});

	it('uses auto behavior when reduced motion is requested', async () => {
		const browser = installWindowMock({ reducedMotion: true, initialScrollY: 1000 });

		await scrollWindowToTopOnce();

		expect(browser.scrollTo).toHaveBeenCalledTimes(1);
		expect(browser.scrollTo).toHaveBeenCalledWith({
			top: 0,
			behavior: 'auto'
		});
	});

	it('uses auto correction if smooth scrolling does not reach the top before timeout', async () => {
		const browser = installWindowMock({ initialScrollY: 1000 });

		const operation = scrollWindowToTopOnce({ timeoutMs: 10 });
		expect(browser.scrollTo).toHaveBeenCalledTimes(1);
		expect(browser.scrollTo).toHaveBeenLastCalledWith({
			top: 0,
			behavior: 'smooth'
		});

		browser.setNow(20);
		browser.flushRaf();

		await operation;

		expect(browser.scrollTo).toHaveBeenCalledTimes(2);
		expect(browser.scrollTo).toHaveBeenLastCalledWith({
			top: 0,
			behavior: 'auto'
		});
	});

	it('resolves via timeout if animation frames stop', async () => {
		vi.useFakeTimers();
		const browser = installWindowMock({ initialScrollY: 1000 });

		const operation = scrollWindowToTopOnce({ timeoutMs: 10 });
		expect(browser.scrollTo).toHaveBeenCalledTimes(1);
		expect(browser.scrollTo).toHaveBeenLastCalledWith({
			top: 0,
			behavior: 'smooth'
		});

		await vi.advanceTimersByTimeAsync(10);
		await operation;

		expect(browser.scrollTo).toHaveBeenCalledTimes(2);
		expect(browser.scrollTo).toHaveBeenLastCalledWith({
			top: 0,
			behavior: 'auto'
		});

		browser.setScrollY(500);
		const later = scrollWindowToTopOnce({ timeoutMs: 10 });
		expect(browser.scrollTo).toHaveBeenCalledTimes(3);

		browser.setScrollY(0);
		browser.flushRaf();
		await later;
	});

	it('does nothing when window is unavailable', async () => {
		vi.stubGlobal('window', undefined);

		await expect(scrollWindowToTopOnce()).resolves.toBeUndefined();
	});
});

describe('timeline scroll-to-top requests', () => {
	it('reports whether a target-specific timeline request was accepted', () => {
		installTimelineEventWindowMock();

		const handler = vi.fn();
		const dispose = onTimelineScrollToTop('/home', handler);

		expect(requestTimelineScrollToTop('/public')).toBe(false);
		expect(handler).not.toHaveBeenCalled();

		expect(requestTimelineScrollToTop('/home')).toBe(true);
		expect(handler).toHaveBeenCalledTimes(1);

		dispose();
		expect(requestTimelineScrollToTop('/home')).toBe(false);
	});

	it('does not report a request as accepted when the matching handler throws synchronously', () => {
		installTimelineEventWindowMock();
		const error = new Error('scroll failed');
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		const dispose = onTimelineScrollToTop('/home', () => {
			throw error;
		});

		expect(requestTimelineScrollToTop('/home')).toBe(false);
		expect(consoleError).toHaveBeenCalledWith('[timeline scroll-to-top]', error);

		dispose();
	});

	it('handles async handler rejections without unhandled promise rejections', async () => {
		installTimelineEventWindowMock();
		const error = new Error('scroll rejected');
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		const dispose = onTimelineScrollToTop('/home', () => Promise.reject(error));

		expect(requestTimelineScrollToTop('/home')).toBe(true);
		await Promise.resolve();
		expect(consoleError).toHaveBeenCalledWith('[timeline scroll-to-top]', error);

		dispose();
	});
});
