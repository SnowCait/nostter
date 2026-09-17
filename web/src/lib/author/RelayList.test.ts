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
});
