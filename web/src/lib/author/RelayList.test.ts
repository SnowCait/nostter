import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';

const { setDefaultRelays } = vi.hoisted(() => ({
	setDefaultRelays: vi.fn()
}));

vi.mock('../timelines/MainTimeline', () => ({
	rxNostr: { setDefaultRelays },
	tie: vi.fn()
}));

import { RelayList } from './RelayList';

function event(kind: number, tags: string[][] = [], content = ''): Event {
	return { kind, tags, content, created_at: 0, id: '', pubkey: '', sig: '' };
}

beforeEach(() => {
	setDefaultRelays.mockClear();
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
});
