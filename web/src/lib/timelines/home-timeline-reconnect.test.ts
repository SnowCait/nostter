import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRxNostr, type LazyFilter, type RxNostr } from 'rx-nostr';
import { tap } from 'rxjs';
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
import { minTimelineLength, timeout } from '$lib/Constants';
import { auth } from '$lib/auth.svelte';

const account = auth as { pubkey: string };

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
	responseDelay = 0;
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
				setTimeout(() => this.receive(['EVENT', message[1], event]), this.responseDelay);
			}
		}
		setTimeout(() => this.receive(['EOSE', message[1]]), this.responseDelay);
	}
	receive(message: unknown[]) {
		this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
	}
}

describe('home timeline reconnect gap', () => {
	let timeline: HomeTimeline;

	async function resume() {
		const rx = client.current!;
		timeline = new HomeTimeline();
		timeline.subscribe();
		await vi.advanceTimersByTimeAsync(0);
		const socketA = Socket.instances.find((s) => s.url === a)!;
		socketA.open();
		Socket.instances.find((s) => s.url === b)!.close(1006);
		expect(rx.getRelayStatus(b)?.connection).toBe('error');
		rx.reconnect(b);
		timeline.clear();
		timeline.older();
		await vi.advanceTimersByTimeAsync(1);
		return { socketA, socketB: Socket.instances.filter((s) => s.url === b).at(-1)! };
	}

	const bounded = (socket: Socket) =>
		socket.sent.filter(
			(m) =>
				m[0] === 'REQ' &&
				(m[2] as Nostr.Filter).since !== undefined &&
				(m[2] as Nostr.Filter).until !== undefined
		);
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(current * 1000);
		Socket.instances = [];
		account.pubkey = 'a'.repeat(64);
		client.current = createRxNostr({
			websocketCtor: Socket as unknown as typeof WebSocket,
			connectionStrategy: 'lazy-keep',
			eoseTimeout: timeout,
			retry: { strategy: 'exponential', maxCount: 5, initialDelay: 1000, polite: true },
			skipVerify: true,
			skipFetchNip11: true
		});
		client.current.setDefaultRelays([a, b]);
	});
	afterEach(() => {
		timeline?.clear();
		client.current?.dispose();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});
	it('recovers the recent window when B reconnects after the backward timeout', async () => {
		const rx = client.current!;
		const completed = vi.fn();
		const generated = new Map<unknown, LazyFilter[]>();
		const use = rx.use.bind(rx);
		vi.spyOn(rx, 'use').mockImplementation((req, options) => {
			if (req.strategy === 'backward') {
				req.getReqPacketObservable().subscribe(({ filters }) =>
					generated.set(req, filters)
				);
			}
			return use(req, options).pipe(tap({ complete: () => completed(req) }));
		});
		expect(fetchMinutes(50)).toBe(15);
		const hiddenAt = current - 16 * 60;
		expect(current - hiddenAt).toBeGreaterThan(fetchMinutes(50) * 60);
		const { socketA, socketB } = await resume();
		const firstReq = vi.mocked(rx.use).mock.calls[1][0];
		const first = socketA.sent.filter(
			(m) => m[0] === 'REQ' && (m[2] as Nostr.Filter).until !== undefined
		)[0];
		for (const filter of generated.get(firstReq)!) {
			expect(filter).toMatchObject({ since: current - 900, until: current });
		}
		expect(first.slice(2)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ since: current - 900, until: current })
			])
		);
		expect(timeline.events.length).toBe(minTimelineLength);
		expect(socketB.sent).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(6000);
		expect(completed).toHaveBeenCalledWith(firstReq);
		expect(timeline.loading).toBe(false);
		timeline.older();
		await vi.advanceTimersByTimeAsync(1);
		const requests = socketA.sent.filter(
			(m) => m[0] === 'REQ' && (m[2] as Nostr.Filter).until !== undefined
		);
		expect(requests[1][2]).toMatchObject({ since: current - 1800, until: current - 900 });
		socketB.open();
		await vi.advanceTimersByTimeAsync(1);
		expect(
			socketB.sent.some((m) => m[0] === 'REQ' && (m[2] as Nostr.Filter).until === current)
		).toBe(true);
		expect(socketB.sent.some((m) => m[0] === 'CLOSE' && m[1] === first[1])).toBe(true);
		expect(timeline.events.some((e) => e.id === recent.id)).toBe(true);
		expect(timeline.events.filter((e) => e.id === recent.id)).toHaveLength(1);
		expect(bounded(socketA)).toHaveLength(2);
		expect(
			new Set(
				bounded(socketB)
					.filter((m) => (m[2] as Nostr.Filter).until === current)
					.map((m) => m[1])
			).size
		).toBe(2);
	});

	it('continues paging A while B never reconnects', async () => {
		const { socketA, socketB } = await resume();
		await vi.advanceTimersByTimeAsync(6000);
		timeline.older();
		await vi.advanceTimersByTimeAsync(6000);
		expect(bounded(socketA)).toHaveLength(2);
		expect(bounded(socketA)[1][2]).toMatchObject({
			until: current - 900,
			since: current - 1800
		});
		expect(timeline.events.length).toBeGreaterThan(minTimelineLength);
		expect(socketB.sent).toHaveLength(0);
	});

	it('does not replay a window if B connects before the original timeout', async () => {
		const { socketB } = await resume();
		await vi.advanceTimersByTimeAsync(1000);
		socketB.open();
		await vi.advanceTimersByTimeAsync(6000);
		expect(timeline.events.some((e) => e.id === recent.id)).toBe(true);
		expect(new Set(bounded(socketB).map((m) => m[1])).size).toBe(1);
	});

	it.each(['clear', 'account change'])('cancels pending recovery on %s', async (action) => {
		const { socketB } = await resume();
		await vi.advanceTimersByTimeAsync(6000);
		if (action === 'clear') {
			timeline.clear();
		} else {
			account.pubkey = 'c'.repeat(64);
			timeline.cancelRecovery();
		}
		socketB.open();
		await vi.advanceTimersByTimeAsync(1);
		expect(new Set(bounded(socketB).map((m) => m[1])).size).toBe(1);
		expect(timeline.events.some((e) => e.id === recent.id)).toBe(false);
	});

	it.each(['clear', 'account change'])('cancels an in-flight recovery on %s', async (action) => {
		const { socketB } = await resume();
		await vi.advanceTimersByTimeAsync(6000);
		socketB.responseDelay = 100;
		socketB.open();
		await vi.advanceTimersByTimeAsync(1);
		expect(new Set(bounded(socketB).map((m) => m[1])).size).toBe(2);
		if (action === 'clear') {
			timeline.clear();
		} else {
			account.pubkey = 'c'.repeat(64);
			timeline.cancelRecovery();
		}
		await vi.advanceTimersByTimeAsync(100);
		expect(timeline.events.some((e) => e.id === recent.id)).toBe(false);
	});

	it('does not recreate cancelled recovery when the original request finishes later', async () => {
		const { socketB } = await resume();
		timeline.cancelRecovery();
		await vi.advanceTimersByTimeAsync(6000);
		socketB.open();
		await vi.advanceTimersByTimeAsync(1);
		expect(new Set(bounded(socketB).map((m) => m[1])).size).toBe(1);
		expect(timeline.events.some((e) => e.id === recent.id)).toBe(false);
	});

	it('does not schedule recovery for an old account when its original request finishes', async () => {
		const { socketB } = await resume();
		account.pubkey = 'c'.repeat(64);
		timeline.cancelRecovery();
		await vi.advanceTimersByTimeAsync(6000);
		socketB.open();
		await vi.advanceTimersByTimeAsync(1);
		expect(new Set(bounded(socketB).map((m) => m[1])).size).toBe(1);
		expect(timeline.events.some((e) => e.id === recent.id)).toBe(false);
	});

	it('recovers the bounded retrieve window without advancing paging', async () => {
		const { socketA, socketB } = await resume();
		timeline.clear();
		timeline.retrieve(current, current - 600);
		await vi.advanceTimersByTimeAsync(6000);
		const sentToA = bounded(socketA).length;
		socketB.open();
		await vi.advanceTimersByTimeAsync(1);
		expect(timeline.events.some((e) => e.id === recent.id)).toBe(true);
		expect(bounded(socketA)).toHaveLength(sentToA);
		expect(bounded(socketB).at(-1)![2]).toMatchObject({ since: current - 600, until: current });
	});

	it('does not restore read permission when B has been disabled', async () => {
		const { socketB } = await resume();
		await vi.advanceTimersByTimeAsync(6000);
		client.current!.setDefaultRelays({
			[a]: { read: true, write: true },
			[b]: { read: false, write: true }
		});
		socketB.open();
		await vi.advanceTimersByTimeAsync(1);
		expect(new Set(bounded(socketB).map((m) => m[1])).size).toBe(1);
		expect(client.current!.getDefaultRelay(b)?.read).toBe(false);
	});
});
