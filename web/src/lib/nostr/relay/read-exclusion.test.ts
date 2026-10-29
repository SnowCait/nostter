import { beforeEach, expect, it, vi } from 'vitest';
import type { Subject } from 'rxjs';
import type { ConnectionState, ConnectionStatePacket } from 'rx-nostr';
import type { RelayEntry } from '$lib/nostr/protocol/nip65';
const mocks = vi.hoisted(() => ({
	states: undefined as unknown as Subject<ConnectionStatePacket>,
	config: {} as Record<string, RelayEntry>,
	status: new Map<string, ConnectionState>()
}));
vi.mock('$lib/relay-client', async () => {
	const { Subject } = await import('rxjs');
	mocks.states = new Subject();
	return {
		rxNostr: {
			createConnectionStateObservable: () => mocks.states,
			getDefaultRelay: (url: string) => mocks.config[url],
			getDefaultRelays: () => mocks.config,
			getRelayStatus: (url: string) => ({ connection: mocks.status.get(url) }),
			setDefaultRelays: vi.fn((relays: RelayEntry[] | Record<string, RelayEntry>) => {
				mocks.config = Array.isArray(relays)
					? Object.fromEntries(relays.map((relay) => [relay.url, relay]))
					: relays;
			})
		}
	};
});
import { rxNostr } from '$lib/relay-client';
import { withReadExclusions, clearReadExclusions } from './read-exclusion';
const a = { url: 'wss://a', read: true, write: false };
function apply(relays: RelayEntry[]) {
	rxNostr.setDefaultRelays(withReadExclusions(relays));
}
function state(state: ConnectionState, from = a.url) {
	mocks.status.set(from, state);
	mocks.states.next({ from, state });
}
beforeEach(() => {
	clearReadExclusions();
	mocks.status.clear();
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
it('keeps the latest write permission and does not restore user-disabled reads', () => {
	state('waiting-for-retrying');
	apply([{ ...a, write: true }]);
	expect(mocks.config[a.url].read).toBe(false);
	state('connected');
	expect(mocks.config[a.url]).toEqual({ ...a, write: true });
	state('waiting-for-retrying');
	apply([{ ...a, read: false }]);
	state('connected');
	expect(mocks.config[a.url].read).toBe(false);
});
it('does not re-add deleted relays or leave a re-added connected relay excluded', () => {
	state('waiting-for-retrying');
	apply([]);
	state('connected');
	expect(mocks.config).toEqual({});
	apply([a]);
	expect(mocks.config[a.url]).toEqual(a);
});
it('keeps exclusions through relay additions and a read off/on edit during retry', () => {
	state('waiting-for-retrying');
	const extra = { url: 'wss://extra', read: true, write: true };
	mocks.config = {
		...mocks.config,
		...Object.fromEntries(withReadExclusions([extra]).map((relay) => [relay.url, relay]))
	};
	expect(mocks.config[a.url].read).toBe(false);
	apply([{ ...a, read: false }]);
	apply([a]);
	expect(mocks.config[a.url].read).toBe(false);
	state('connected');
	expect(mocks.config[a.url].read).toBe(true);
});
it('does not modify the editor list used for saving and publication', () => {
	const editor = [{ ...a }];
	state('waiting-for-retrying');
	apply(editor);
	expect(editor).toEqual([a]);
	expect(mocks.config[a.url].read).toBe(false);
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
