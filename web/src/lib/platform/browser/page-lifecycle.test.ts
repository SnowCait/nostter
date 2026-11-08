import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { observePageLifecycle } from './page-lifecycle';
let visibility: DocumentVisibilityState;
let focused: boolean;
let doc: EventTarget;
let win: EventTarget;
let stop: (() => void) | undefined;
const foreground = vi.fn();
beforeEach(() => {
	visibility = 'visible';
	focused = false;
	doc = new EventTarget();
	win = new EventTarget();
	Object.defineProperty(doc, 'visibilityState', { get: () => visibility });
	Object.assign(doc, { hasFocus: () => focused });
	vi.stubGlobal('document', doc);
	vi.stubGlobal('window', win);
	foreground.mockClear();
	vi.spyOn(console, 'debug').mockImplementation(() => {});
});
afterEach(() => {
	stop?.();
	stop = undefined;
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});
function emit(type: string) {
	(['pagehide', 'pageshow', 'focus', 'blur'].includes(type) ? win : doc).dispatchEvent(
		new Event(type)
	);
}
it.each(['visibilitychange', 'freeze', 'pagehide'])(
	'stops on %s and deduplicates stops',
	(event) => {
		stop = observePageLifecycle(vi.fn(), foreground);
		if (event === 'visibilitychange') {
			visibility = 'hidden';
		}
		emit(event);
		emit('freeze');
		emit('pagehide');
		expect(foreground.mock.calls).toEqual([[true], [false]]);
	}
);
it.each(['resume', 'pageshow', 'focus'])(
	'checks current signals on auxiliary %s recovery',
	(event) => {
		stop = observePageLifecycle(vi.fn(), foreground);
		emit('freeze');
		// A visible value may be stale after a stop; the event alone is insufficient.
		emit(event);
		expect(foreground).toHaveBeenLastCalledWith(false);
		visibility = 'hidden';
		focused = true;
		emit(event);
		expect(foreground).toHaveBeenLastCalledWith(false);
		// These inputs exercise our policy, without assuming Android updates either API.
		visibility = 'visible';
		emit(event);
		emit(event);
		expect(foreground.mock.calls).toEqual([[true], [false], [true]]);
	}
);
it('accepts visible pages without focus and ignores blur', () => {
	visibility = 'hidden';
	stop = observePageLifecycle(vi.fn(), foreground);
	visibility = 'visible';
	emit('visibilitychange');
	emit('blur');
	emit('pageshow');
	expect(foreground.mock.calls).toEqual([[false], [true]]);
});
it('removes listeners on cleanup', () => {
	stop = observePageLifecycle(vi.fn(), foreground);
	stop();
	emit('freeze');
	emit('pagehide');
	expect(foreground.mock.calls).toEqual([[true]]);
});
it('can be called during SSR', () => {
	vi.stubGlobal('document', undefined);
	vi.stubGlobal('window', undefined);
	expect(() => observePageLifecycle(vi.fn(), foreground)()).not.toThrow();
	expect(foreground).not.toHaveBeenCalled();
});
