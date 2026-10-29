import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { EMPTY } from 'rxjs';

const { setDefaultRelays, use, cached } = vi.hoisted(() => ({
	setDefaultRelays: vi.fn(),
	use: vi.fn(),
	cached: new Map<string, Event>()
}));

vi.mock('../cache/Events', () => ({
	accountAddressableEventCache: {
		get: async (pubkey: string, kind: number) => cached.get(`${pubkey}:${kind}`)
	}
}));

vi.mock('../timelines/MainTimeline', () => ({
	rxNostr: { setDefaultRelays, use },
	tie: <T>(source: T): T => source
}));

import { RelayList } from './RelayList';

function event(kind: number, tags: string[][] = [], content = ''): Event {
	return { kind, tags, content, created_at: 0, id: '', pubkey: '', sig: '' };
}

beforeEach(() => {
	setDefaultRelays.mockClear();
	use.mockReset().mockReturnValue(EMPTY);
	cached.clear();
});

describe('RelayList.apply', () => {
	it('applies only valid NIP-65 relay tags and preserves their read/write modes', () => {
		RelayList.apply(
			new Map([
				[
					10002,
					event(10002, [
						['client', 'nostter'],
						['r', 'wss://both.example'],
						['r', 'wss://read.example', 'read'],
						['r', 'wss://write.example', 'write'],
						['r'],
						['r', 'not-a-relay-url'],
						['r', 'wss://unknown-marker.example', 'other']
					])
				],
				[
					3,
					event(
						3,
						[],
						JSON.stringify({
							'wss://legacy.example': { read: true, write: true }
						})
					)
				]
			])
		);

		expect(setDefaultRelays).toHaveBeenCalledOnce();
		expect(setDefaultRelays).toHaveBeenCalledWith([
			{ url: 'wss://both.example', read: true, write: true },
			{ url: 'wss://read.example', read: true, write: false },
			{ url: 'wss://write.example', read: false, write: true }
		]);
	});

	it('keeps the legacy kind 3 fallback when no NIP-65 relay tags are provided', () => {
		RelayList.apply(
			new Map([
				[10002, event(10002)],
				[
					3,
					event(
						3,
						[],
						JSON.stringify({
							'wss://legacy.example': { read: true, write: false }
						})
					)
				]
			])
		);

		expect(setDefaultRelays).toHaveBeenCalledOnce();
		expect(setDefaultRelays).toHaveBeenCalledWith([
			{ url: 'wss://legacy.example', read: true, write: false }
		]);
	});

	it('uses the legacy kind 3 fallback when kind 10002 has only non-relay tags', () => {
		RelayList.apply(
			new Map([
				[10002, event(10002, [['client', 'nostter']])],
				[
					3,
					event(
						3,
						[],
						JSON.stringify({
							'wss://legacy.example': { read: true, write: true }
						})
					)
				]
			])
		);

		expect(setDefaultRelays).toHaveBeenCalledOnce();
		expect(setDefaultRelays).toHaveBeenCalledWith([
			{ url: 'wss://legacy.example', read: true, write: true }
		]);
	});

	it('uses the legacy kind 3 fallback when kind 10002 has only invalid relay tags', () => {
		RelayList.apply(
			new Map([
				[
					10002,
					event(10002, [
						['r'],
						['r', 'not-a-relay-url'],
						['r', 'wss://unknown-marker.example', 'other']
					])
				],
				[
					3,
					event(
						3,
						[],
						JSON.stringify({
							'wss://legacy.example': { read: false, write: true }
						})
					)
				]
			])
		);

		expect(setDefaultRelays).toHaveBeenCalledOnce();
		expect(setDefaultRelays).toHaveBeenCalledWith([
			{ url: 'wss://legacy.example', read: false, write: true }
		]);
	});

	it('keeps application relays when neither account relay list is usable', () => {
		RelayList.apply(
			new Map([
				[10002, event(10002, [['r', 'not-a-relay-url']])],
				[
					3,
					event(3, [], JSON.stringify({ 'not-a-relay-url': { read: true, write: true } }))
				]
			])
		);

		expect(setDefaultRelays).not.toHaveBeenCalled();
	});
});

describe('RelayList.fetchEvents', () => {
	it('uses only the requested account cache and fetches on a miss', async () => {
		const a = 'a'.repeat(64);
		const b = 'b'.repeat(64);
		const contacts = { ...event(3), pubkey: a };
		cached.set(`${a}:3`, contacts);
		expect((await RelayList.fetchEvents(a)).get(3)).toEqual(contacts);
		expect(use).not.toHaveBeenCalled();
		expect((await RelayList.fetchEvents(b)).size).toBe(0);
		expect(use).toHaveBeenCalledOnce();
	});
});

vi.mock('$lib/relay-client', () => ({
	relayReadExclusion: { set: setDefaultRelays, reset: setDefaultRelays }
}));

it('keeps cached user relay tags intact while their effective reads are excluded', async () => {
	const { Subject } = await import('rxjs');
	const { createRelayReadExclusion } = await import('../nostr/relay/read-exclusion');
	const states = new Subject<import('rx-nostr').ConnectionStatePacket>();
	let effective: Record<string, import('../nostr/protocol/nip65').RelayEntry> = {};
	const exclusion = createRelayReadExclusion({
		getDefaultRelay: (url: string) => effective[url],
		getDefaultRelays: () => effective,
		getRelayStatus: () => ({ connection: 'connected' }),
		createConnectionStateObservable: () => states,
		setDefaultRelays: (
			relays: typeof effective | import('../nostr/protocol/nip65').RelayEntry[]
		) => {
			effective = Array.isArray(relays)
				? Object.fromEntries(relays.map((relay) => [relay.url, relay]))
				: relays;
		}
	} as unknown as import('rx-nostr').RxNostr);
	setDefaultRelays.mockImplementation(exclusion.set);
	const pubkey = 'a'.repeat(64);
	const userEvent = { ...event(10002, [['r', 'wss://reader.example', 'read']]), pubkey };
	cached.set(`${pubkey}:10002`, userEvent);
	RelayList.apply(await RelayList.fetchEvents(pubkey));
	states.next({ from: 'wss://reader.example', state: 'waiting-for-retrying' });
	expect(effective['wss://reader.example'].read).toBe(false);
	expect((await RelayList.fetchEvents(pubkey)).get(10002)?.tags).toEqual([
		['r', 'wss://reader.example', 'read']
	]);
	expect(use).not.toHaveBeenCalled();
	setDefaultRelays.mockReset();
});
