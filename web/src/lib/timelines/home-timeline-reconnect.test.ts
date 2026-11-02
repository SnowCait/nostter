import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRxNostr, type RxNostr } from 'rx-nostr';
import type * as Nostr from 'nostr-typedef';
const client = vi.hoisted(() => ({ current: undefined as RxNostr | undefined }));
vi.mock('./MainTimeline', () => ({
	get rxNostr() {
		return client.current;
	},
	tie: <T>(source: T): T => source,
	referencesReqEmit: vi.fn(),
	storeSeenOn: vi.fn()
}));
vi.mock('$lib/UserStatus', () => ({ updateUserStatus: vi.fn(), userStatusReqEmit: vi.fn() }));
vi.mock('$lib/author/Action', () => ({
	authorActionReqEmit: vi.fn(),
	updateReactionedEvents: vi.fn(),
	updateRepostedEvents: vi.fn()
}));
vi.mock('$lib/stores/LastNotes', () => ({ saveLastNote: vi.fn() }));
vi.mock('$lib/auth.svelte', () => ({
	auth: {
		pubkey: 'a'.repeat(64),
		followees: Array.from({ length: 50 }, (_, i) => i.toString(16).padStart(64, '0')),
		signer: undefined
	}
}));

import { HomeTimeline } from './HomeTimeline';
import { fetchMinutes } from '$lib/Helper';
import { minTimelineLength } from '$lib/Constants';

const current = 1_000_000;
const a = 'wss://a.example';
const b = 'wss://b.example';
const recent = {
	id: 'f'.repeat(64),
	pubkey: '0'.repeat(64),
	kind: 1,
	created_at: current - 100,
	content: 'recent B',
	tags: [],
	sig: '0'.repeat(128)
};
class Socket extends EventTarget {
	static instances: Socket[] = [];
	readyState = 0;
	sent: unknown[][] = [];
	constructor(readonly url: string) {
		super();
		Socket.instances.push(this);
	}
	open() {
		this.readyState = 1;
		this.dispatchEvent(new Event('open'));
	}
	close(code = 1000) {
		this.readyState = 3;
		this.dispatchEvent(new CloseEvent('close', { code }));
	}
	send(data: string) {
		const message = JSON.parse(data);
		this.sent.push(message);
		if (message[0] !== 'REQ') {
			return;
		}
		const filters = message.slice(2) as Nostr.Filter[];
		const eventTime = this.url === b ? recent.created_at : (filters[0].until ?? current) - 1;
		if (
			filters.some((f) => (f.since ?? 0) <= eventTime && (f.until ?? Infinity) >= eventTime)
		) {
			const events =
				this.url === b
					? [recent]
					: Array.from({ length: minTimelineLength }, (_, i) => ({
							...recent,
							id: (eventTime * 100 + i).toString(16).padStart(64, '0'),
							created_at: eventTime
						}));
			for (const event of events) {
				setTimeout(() => this.receive(['EVENT', message[1], event]), 0);
			}
		}
		setTimeout(() => this.receive(['EOSE', message[1]]), 0);
	}
	receive(message: unknown[]) {
		this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
	}
}

describe('home timeline reconnect gap', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(current * 1000);
		Socket.instances = [];
		client.current = createRxNostr({
			websocketCtor: Socket as unknown as typeof WebSocket,
			connectionStrategy: 'lazy-keep',
			eoseTimeout: 5000,
			retry: { strategy: 'exponential', maxCount: 5, initialDelay: 1000, polite: true },
			skipVerify: true,
			skipFetchNip11: true
		});
		client.current.setDefaultRelays([a, b]);
	});
	afterEach(() => {
		client.current?.dispose();
		vi.useRealTimers();
	});
	it('recovers the recent window when B reconnects after the backward timeout', async () => {
		const rx = client.current!;
		const timeline = new HomeTimeline();
		timeline.subscribe();
		await vi.advanceTimersByTimeAsync(0);
		Socket.instances.find((s) => s.url === a)!.open();
		Socket.instances.find((s) => s.url === b)!.close(1006);
		expect(rx.getRelayStatus(b)?.connection).toBe('error');
		expect(fetchMinutes(50)).toBe(15);
		const hiddenAt = current - 16 * 60;
		expect(current - hiddenAt).toBeGreaterThan(fetchMinutes(50) * 60);
		rx.reconnect(b);
		timeline.clear();
		timeline.older();
		await vi.advanceTimersByTimeAsync(1);
		const socketA = Socket.instances.find((s) => s.url === a)!;
		const socketB = Socket.instances.filter((s) => s.url === b).at(-1)!;
		const first = socketA.sent.filter(
			(m) => m[0] === 'REQ' && (m[2] as Nostr.Filter).until !== undefined
		)[0];
		expect(first.slice(2)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ since: current - 900, until: current })
			])
		);
		expect(timeline.events.length).toBe(minTimelineLength);
		expect(socketB.sent).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(6000);
		expect(timeline.loading).toBe(false);
		timeline.older();
		await vi.advanceTimersByTimeAsync(1);
		const bounded = socketA.sent.filter(
			(m) => m[0] === 'REQ' && (m[2] as Nostr.Filter).until !== undefined
		);
		expect(bounded[1][2]).toMatchObject({ since: current - 1800, until: current - 900 });
		socketB.open();
		await vi.advanceTimersByTimeAsync(1);
		expect(
			socketB.sent.some((m) => m[0] === 'REQ' && (m[2] as Nostr.Filter).until === current)
		).toBe(true);
		expect(socketB.sent.some((m) => m[0] === 'CLOSE' && m[1] === first[1])).toBe(true);
		expect(timeline.events.some((e) => e.id === recent.id)).toBe(true);
		timeline.clear();
	});
});
