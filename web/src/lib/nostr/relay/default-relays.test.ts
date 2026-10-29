import { beforeEach, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import type { ConnectionStatePacket, RxNostr } from 'rx-nostr';
import type { RelayEntry } from '$lib/nostr/protocol/nip65';
import { createDefaultRelaySettings } from './default-relays';

let states: Subject<ConnectionStatePacket>;
let effective: RelayEntry[];
let settings: ReturnType<typeof createDefaultRelaySettings>;
beforeEach(() => {
	states = new Subject();
	effective = [];
	settings = createDefaultRelaySettings({
		setDefaultRelays: vi.fn((relays: RelayEntry[]) => {
			effective = relays;
		}),
		getDefaultRelay: (url: string) => effective.find((relay) => relay.url === url),
		createConnectionStateObservable: () => states
	} as unknown as RxNostr);
	settings.set([
		{ url: 'wss://a', read: true, write: true },
		{ url: 'wss://b', read: false, write: true }
	]);
});
function state(state: ConnectionStatePacket['state'], from = 'wss://a') {
	states.next({ from, state });
}
it('excludes retrying reads without changing write or the settings used for saving and publishing', () => {
	state('waiting-for-retrying');
	state('retrying');
	expect(effective[0]).toEqual({ url: 'wss://a', read: false, write: true });
	expect(settings.get()['wss://a']).toEqual({ url: 'wss://a', read: true, write: true });
	state('connected');
	expect(effective[0].read).toBe(true);
});
it.each(['error', 'rejected'] as const)('clears exclusion on %s', (terminal) => {
	state('waiting-for-retrying');
	state(terminal);
	expect(effective[0].read).toBe(true);
});
it('preserves exclusion across user updates while applying the latest write permission', () => {
	state('waiting-for-retrying');
	settings.set([{ url: 'wss://a', read: true, write: false }]);
	expect(effective[0]).toEqual({ url: 'wss://a', read: false, write: false });
	state('connected');
	expect(effective[0]).toEqual({ url: 'wss://a', read: true, write: false });
});
it('does not restore a user-disabled read or re-add a deleted relay', () => {
	state('waiting-for-retrying');
	settings.set([{ url: 'wss://a', read: false, write: true }]);
	state('connected');
	expect(effective[0].read).toBe(false);
	settings.set(['wss://a']);
	state('waiting-for-retrying');
	settings.set([]);
	state('connected');
	expect(effective).toEqual([]);
});
it('resets temporary exclusion at an account boundary', () => {
	state('waiting-for-retrying');
	settings.reset(['wss://a']);
	expect(effective[0].read).toBe(true);
});
it('ignores non-default and write-only relays and other connection states', () => {
	const original = effective;
	state('waiting-for-retrying', 'wss://temporary');
	state('waiting-for-retrying', 'wss://b');
	state('connecting');
	state('dormant');
	expect(effective).toBe(original);
});
it('returns snapshots that cannot mutate user settings', () => {
	const snapshot = settings.get();
	snapshot['wss://a'].read = false;
	expect(settings.get()['wss://a'].read).toBe(true);
});

it('keeps exclusion and intended permissions when a page adds a default relay', () => {
	state('waiting-for-retrying');
	settings.add({ url: 'wss://page', read: true, write: false });
	expect(effective.find((relay) => relay.url === 'wss://a')?.read).toBe(false);
	expect(settings.get()['wss://a'].read).toBe(true);
	expect(effective.find((relay) => relay.url === 'wss://page')).toEqual({
		url: 'wss://page',
		read: true,
		write: false
	});
});

it('keeps a retry exclusion when reads are toggled off and back on before recovery', () => {
	state('waiting-for-retrying');
	settings.set([{ url: 'wss://a', read: false, write: true }]);
	settings.set([{ url: 'wss://a', read: true, write: true }]);
	expect(effective[0].read).toBe(false);
	state('connected');
	expect(effective[0].read).toBe(true);
});
