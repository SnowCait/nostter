// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Layout from './+layout.svelte';
const mocks = vi.hoisted(() => ({
	restore: vi.fn(),
	reconnect: vi.fn(),
	retrieve: vi.fn(),
	clear: vi.fn(),
	older: vi.fn(),
	subscribe: vi.fn(),
	fetch: vi.fn(),
	notice: vi.fn()
}));
vi.mock('$lib/relay-client', () => ({
	rxNostr: {
		getDefaultRelays: () => ({ a: { url: 'a' } }),
		getRelayStatus: () => ({ connection: 'error' }),
		reconnect: mocks.reconnect
	}
}));
vi.mock('$lib/nostr/relay/read-exclusion', () => ({ restoreReadExclusions: mocks.restore }));
vi.mock('$lib/timelines/HomeTimeline', () => ({ timeline: mocks }));
vi.mock('$lib/author/Notifications', () => ({
	fetchLastNotification: mocks.fetch,
	notifiedEventItems: { set: mocks.notice }
}));
vi.mock('$lib/auth.svelte', () => ({ auth: { isAuthenticated: true, followees: [] } }));
vi.mock('$lib/Helper', () => ({ fetchMinutes: () => 10 }));
vi.mock('$lib/Theme', () => ({ applyTheme: vi.fn() }));
vi.mock('$lib/NoteDialogContext', () => ({ setOpenNoteDialog: vi.fn() }));
vi.mock('$lib/components/Notice.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/Gdpr.svelte', () => ({ default: () => {} }));
vi.mock('./Header.svelte', () => ({ default: () => {} }));
vi.mock('./NoteDialog.svelte', () => ({ default: () => {} }));
let component: ReturnType<typeof mount> | undefined;
function visibility(value: string) {
	Object.defineProperty(document, 'visibilityState', { configurable: true, value });
	document.dispatchEvent(new Event('visibilitychange'));
}
function lifecycle(type: string, persisted = false) {
	(type.startsWith('page') ? window : document).dispatchEvent(
		Object.assign(new Event(type), { persisted })
	);
}
beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(1000000);
	Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
	component = mount(Layout, { target: document.body });
	flushSync();
	vi.clearAllMocks();
	visibility('hidden');
});
afterEach(async () => {
	if (component) {
		await unmount(component);
		component = undefined;
	}
	vi.useRealTimers();
});
it.each([299, 300])('uses the 300-second threshold at %s seconds', (seconds) => {
	vi.advanceTimersByTime(seconds * 1000);
	visibility('visible');
	expect(mocks.restore).toHaveBeenCalledTimes(seconds >= 300 ? 1 : 0);
	expect(mocks.retrieve).toHaveBeenCalledTimes(1);
});
it.each(['freeze', 'pagehide'])(
	'recovers once when visibility precedes restoration after %s',
	(type) => {
		lifecycle(type, true);
		vi.advanceTimersByTime(1000);
		visibility('visible');
		lifecycle('resume');
		lifecycle('pageshow', true);
		visibility('visible');
		expect(mocks.restore).toHaveBeenCalledTimes(1);
		expect(mocks.reconnect).toHaveBeenCalledTimes(1);
		expect(mocks.retrieve).toHaveBeenCalledTimes(1);
	}
);
it.each(['resume', 'pageshow'])('defers hidden %s until visible', (type) => {
	lifecycle(type === 'resume' ? 'freeze' : 'pagehide', true);
	lifecycle(type, true);
	expect(mocks.restore).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1000);
	visibility('visible');
	lifecycle('pageshow', true);
	lifecycle('resume');
	expect(mocks.restore).toHaveBeenCalledTimes(1);
	expect(mocks.retrieve).toHaveBeenCalledTimes(1);
});
it('does not force recovery for a nonpersisted pageshow', () => {
	lifecycle('pagehide', false);
	vi.advanceTimersByTime(1000);
	lifecycle('pageshow', false);
	visibility('visible');
	expect(mocks.restore).not.toHaveBeenCalled();
	expect(mocks.retrieve).toHaveBeenCalledTimes(1);
});
it('preserves the strict timeline refresh threshold', () => {
	vi.advanceTimersByTime(600000);
	visibility('visible');
	expect(mocks.retrieve).toHaveBeenCalledTimes(1);
	expect(mocks.clear).not.toHaveBeenCalled();
	visibility('hidden');
	vi.advanceTimersByTime(601000);
	visibility('visible');
	expect(mocks.clear).toHaveBeenCalledTimes(1);
	expect(mocks.older).toHaveBeenCalledTimes(1);
});

it.each(['resume', 'pageshow'])('handles visible %s before visibilitychange', (type) => {
	vi.advanceTimersByTime(1000);
	Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
	lifecycle(type, true);
	visibility('visible');
	lifecycle(type, true);
	expect(mocks.restore).toHaveBeenCalledTimes(1);
	expect(mocks.retrieve).toHaveBeenCalledTimes(1);
	expect(mocks.subscribe).not.toHaveBeenCalled();
});
it('removes lifecycle listeners when unmounted', async () => {
	if (component) {
		await unmount(component);
		component = undefined;
	}
	vi.advanceTimersByTime(300000);
	visibility('visible');
	lifecycle('resume');
	expect(mocks.restore).not.toHaveBeenCalled();
});
