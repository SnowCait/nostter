import { beforeEach, expect, it, vi } from 'vitest';
import type { Subject } from 'rxjs';
import type { ConnectionState, ConnectionStatePacket } from 'rx-nostr';
import type { RelayEntry } from '$lib/nostr/protocol/nip65';
const mocks = vi.hoisted(() => ({
	states: undefined as unknown as Subject<ConnectionStatePacket>,
	config: {} as Record<string, RelayEntry>
}));
vi.mock('$lib/relay-client', async () => {
	const { Subject } = await import('rxjs');
	mocks.states = new Subject();
	return {
		rxNostr: {
			createConnectionStateObservable: () => mocks.states,
			getDefaultRelay: (url: string) => mocks.config[url],
			getDefaultRelays: () => mocks.config,
			setDefaultRelays: vi.fn((relays: RelayEntry[] | Record<string, RelayEntry>) => {
				mocks.config = Array.isArray(relays)
					? Object.fromEntries(relays.map((relay) => [relay.url, relay]))
					: relays;
			})
		}
	};
});
import { rxNostr } from '$lib/relay-client';
import { observePageLifecycle } from '$lib/platform/browser/page-lifecycle';
import {
	clearReadExclusions,
	restoreReadExclusions,
	setReadExclusionsEnabled
} from './read-exclusion';
const a = { url: 'wss://a', read: true, write: false };
function apply(relays: RelayEntry[]) {
	rxNostr.setDefaultRelays(relays);
}
function state(state: ConnectionState, from = a.url) {
	mocks.states.next({ from, state });
}
beforeEach(() => {
	clearReadExclusions();
	setReadExclusionsEnabled(true);
	mocks.config = {};
	apply([a, { url: 'wss://write', read: false, write: true }]);
});
it('temporarily excludes readable defaults and restores the original permission without changing write', () => {
	state('waiting-for-retrying');
	state('retrying');
	expect(mocks.config[a.url]).toEqual({ ...a, read: false });
	state('connected');
	expect(mocks.config[a.url]).toEqual(a);
});
it.each(['error', 'rejected'] as const)('releases exclusion on %s', (terminal) => {
	state('waiting-for-retrying');
	state(terminal);
	expect(mocks.config[a.url]).toEqual(a);
});
it('does not re-add a relay removed before recovery', () => {
	state('waiting-for-retrying');
	apply([]);
	state('connected');
	expect(mocks.config).toEqual({});
});
it('clears old exclusions when switching accounts', () => {
	state('waiting-for-retrying');
	clearReadExclusions();
	apply([{ ...a, read: false }]);
	state('connected');
	expect(mocks.config[a.url].read).toBe(false);
});
it('ignores write-only, temporary and initial connection states', () => {
	const config = mocks.config;
	state('waiting-for-retrying', 'wss://write');
	state('waiting-for-retrying', 'wss://temporary');
	state('connecting');
	state('dormant');
	expect(mocks.config).toBe(config);
});

it('restores all current exclusions in one update while preserving write permissions', () => {
	const b = { url: 'wss://b', read: true, write: true };
	const writeOnly = { url: 'wss://write', read: false, write: true };
	apply([a, b, writeOnly]);
	state('waiting-for-retrying');
	state('waiting-for-retrying', b.url);
	vi.mocked(rxNostr.setDefaultRelays).mockClear();
	restoreReadExclusions();
	expect(mocks.config).toEqual({ [a.url]: a, [b.url]: b, [writeOnly.url]: writeOnly });
	expect(rxNostr.setDefaultRelays).toHaveBeenCalledTimes(1);

	vi.mocked(rxNostr.setDefaultRelays).mockClear();
	state('connected');
	restoreReadExclusions();
	expect(rxNostr.setDefaultRelays).not.toHaveBeenCalled();
});

it('does not re-add removed exclusions or retain their tracking after restoration', () => {
	state('waiting-for-retrying');
	apply([]);
	vi.mocked(rxNostr.setDefaultRelays).mockClear();
	restoreReadExclusions();
	expect(mocks.config).toEqual({});
	expect(rxNostr.setDefaultRelays).not.toHaveBeenCalled();
	apply([{ ...a, read: false }]);
	state('connected');
	expect(mocks.config[a.url].read).toBe(false);
});

it('does not restore exclusions cleared for an account switch', () => {
	state('waiting-for-retrying');
	clearReadExclusions();
	expect(mocks.config[a.url].read).toBe(false);
	vi.mocked(rxNostr.setDefaultRelays).mockClear();
	restoreReadExclusions();
	expect(mocks.config[a.url].read).toBe(false);
	expect(rxNostr.setDefaultRelays).not.toHaveBeenCalled();
});

it('restores on suspension, ignores retries while suspended, and excludes again after resuming', () => {
	state('waiting-for-retrying');
	vi.mocked(rxNostr.setDefaultRelays).mockClear();
	setReadExclusionsEnabled(false);
	setReadExclusionsEnabled(false);
	expect(mocks.config[a.url]).toEqual(a);
	expect(rxNostr.setDefaultRelays).toHaveBeenCalledTimes(1);
	vi.mocked(rxNostr.setDefaultRelays).mockClear();
	state('waiting-for-retrying');
	setReadExclusionsEnabled(true);
	setReadExclusionsEnabled(true);
	expect(rxNostr.setDefaultRelays).not.toHaveBeenCalled();
	state('waiting-for-retrying');
	expect(mocks.config[a.url]).toEqual({ ...a, read: false });
});

it('keeps account changes authoritative while suspended', () => {
	state('waiting-for-retrying');
	clearReadExclusions();
	apply([{ ...a, read: false }]);
	setReadExclusionsEnabled(false);
	setReadExclusionsEnabled(true);
	state('waiting-for-retrying');
	state('connected');
	expect(mocks.config[a.url]).toEqual({ ...a, read: false });
});

it.each(['visibilitychange', 'freeze', 'pagehide'])(
	'restores and suspends exclusions on lifecycle %s',
	(event) => {
		const doc = new EventTarget();
		const win = new EventTarget();
		let visibility = 'visible';
		Object.defineProperty(doc, 'visibilityState', { get: () => visibility });
		Object.assign(doc, { hasFocus: () => true });
		vi.stubGlobal('document', doc);
		vi.stubGlobal('window', win);
		const stop = observePageLifecycle(() => {}, setReadExclusionsEnabled);
		try {
			state('waiting-for-retrying');
			visibility = 'hidden';
			(event === 'pagehide' ? win : doc).dispatchEvent(new Event(event));
			expect(mocks.config[a.url]).toEqual(a);
			state('waiting-for-retrying');
			expect(mocks.config[a.url]).toEqual(a);
			visibility = 'visible';
			win.dispatchEvent(new Event('focus'));
			state('waiting-for-retrying');
			expect(mocks.config[a.url]).toEqual({ ...a, read: false });
		} finally {
			stop();
			vi.unstubAllGlobals();
		}
	}
);
