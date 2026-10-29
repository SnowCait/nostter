import { beforeEach, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import type { ConnectionStatePacket, RxNostr } from 'rx-nostr';
import type { RelayEntry } from '$lib/nostr/protocol/nip65';
import { createRelayReadExclusion } from './read-exclusion';
let states: Subject<ConnectionStatePacket>;
let effective: Record<string, RelayEntry>;
let settings: ReturnType<typeof createRelayReadExclusion>;
let status: ConnectionStatePacket['state'];
beforeEach(() => {
	states = new Subject();
	effective = {};
	status = 'connected';
	settings = createRelayReadExclusion({
		setDefaultRelays: vi.fn((relays: RelayEntry[] | Record<string, RelayEntry>) => {
			effective = Array.isArray(relays)
				? Object.fromEntries(relays.map((relay) => [relay.url, relay]))
				: relays;
		}),
		getDefaultRelay: (url: string) => effective[url],
		getDefaultRelays: () => effective,
		getRelayStatus: () => ({ connection: status }),
		createConnectionStateObservable: () => states
	} as unknown as RxNostr);
	settings.set([
		{ url: 'wss://a', read: true, write: false },
		{ url: 'wss://b', read: false, write: true }
	]);
});
function state(next: ConnectionStatePacket['state'], from = 'wss://a') {
	status = next;
	states.next({ from, state: next });
}
it('temporarily excludes a readable default and restores it without changing write', () => {
	state('waiting-for-retrying');
	state('retrying');
	expect(effective['wss://a']).toEqual({ url: 'wss://a', read: false, write: false });
	state('connected');
	expect(effective['wss://a'].read).toBe(true);
});
it.each(['error', 'rejected'] as const)('releases exclusion on %s', (terminal) => {
	state('waiting-for-retrying');
	state(terminal);
	expect(effective['wss://a'].read).toBe(true);
});
it('preserves the latest user write change while keeping retrying reads excluded', () => {
	state('waiting-for-retrying');
	settings.set([{ url: 'wss://a', read: true, write: true }]);
	expect(effective['wss://a'].read).toBe(false);
	state('connected');
	expect(effective['wss://a']).toEqual({ url: 'wss://a', read: true, write: true });
});
it('does not undo user-disabled reads or re-add deleted relays', () => {
	state('waiting-for-retrying');
	settings.set([{ url: 'wss://a', read: false, write: true }]);
	state('connected');
	expect(effective['wss://a'].read).toBe(false);
	settings.set([{ url: 'wss://a', read: true, write: true }]);
	state('waiting-for-retrying');
	settings.set([]);
	state('connected');
	expect(effective).toEqual({});
});
it('keeps exclusions when a page adds a relay', () => {
	state('waiting-for-retrying');
	settings.add({ url: 'wss://page', read: true, write: false });
	expect(effective['wss://a'].read).toBe(false);
	state('connected');
	expect(effective['wss://a'].read).toBe(true);
});
it('does not mutate the user list used for publication', () => {
	const user = [{ url: 'wss://a', read: true, write: false }];
	settings.set(user);
	state('waiting-for-retrying');
	expect(user).toEqual([{ url: 'wss://a', read: true, write: false }]);
});
it('clears exclusions at account reset', () => {
	state('waiting-for-retrying');
	settings.reset([{ url: 'wss://new', read: true, write: true }]);
	state('connected', 'wss://a');
	expect(Object.keys(effective)).toEqual(['wss://new']);
});
it('ignores write-only, temporary and initially connecting relays', () => {
	const previous = effective;
	state('waiting-for-retrying', 'wss://b');
	state('waiting-for-retrying', 'wss://temporary');
	state('connecting');
	state('dormant');
	expect(effective).toBe(previous);
});

it('does not re-enable reads when a user toggles them during a retry', () => {
	state('waiting-for-retrying');
	settings.set([{ url: 'wss://a', read: false, write: true }]);
	settings.set([{ url: 'wss://a', read: true, write: true }]);
	expect(effective['wss://a'].read).toBe(false);
	state('connected');
	expect(effective['wss://a'].read).toBe(true);
});
