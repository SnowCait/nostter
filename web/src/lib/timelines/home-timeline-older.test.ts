import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import type { LazyFilter } from 'rx-nostr';

interface Packet {
	event: Nostr.Event;
	from: string;
}

interface Operation {
	filters: LazyFilter[];
	packets: Subject<Packet>;
}

const mocks = vi.hoisted(() => ({
	use: vi.fn(),
	createRxBackwardReq: vi.fn()
}));
vi.mock('rx-nostr', async (importOriginal) => ({
	...(await importOriginal<typeof import('rx-nostr')>()),
	createRxBackwardReq: mocks.createRxBackwardReq
}));
vi.mock('./MainTimeline', () => ({
	rxNostr: { use: mocks.use },
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
	auth: { pubkey: 'a'.repeat(64), followees: ['b'.repeat(64)], signer: undefined }
}));

import { HomeTimeline } from './HomeTimeline';
import { fetchMinutes } from '$lib/Helper';
import { minTimelineLength } from '$lib/Constants';

const current = 1_000_000;
const fetchWindow = fetchMinutes(1) * 60;

function note(id: string, createdAt: number): Nostr.Event {
	return {
		id,
		pubkey: 'b'.repeat(64),
		kind: Kind.ShortTextNote,
		created_at: createdAt,
		tags: [],
		content: '',
		sig: 'sig'
	};
}

function expectRange(operation: Operation, since: number, until: number): void {
	expect(operation.filters.length).toBeGreaterThan(0);
	for (const filter of operation.filters) {
		expect(filter).toMatchObject({ since, until });
	}
}

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('HomeTimeline older', () => {
	let operations: Operation[];
	let forwardPackets: Subject<Packet>;
	let timeline: HomeTimeline;

	const bounded = () => operations.filter(({ filters }) => filters[0]?.since !== undefined);
	const fetchEnough = () => operations.filter(({ filters }) => filters[0]?.limit !== undefined);
	const send = (operation: Operation, ...events: Nostr.Event[]) => {
		for (const event of events) {
			operation.packets.next({ event, from: 'relay.example' });
		}
	};
	const ids = () => timeline.events.map((event) => event.id);
	const storedIds = () => {
		timeline.scrollToTop();
		return ids();
	};

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(current * 1000);
		operations = [];
		forwardPackets = new Subject();
		mocks.createRxBackwardReq.mockReset().mockImplementation(() => {
			const operation: Operation = { filters: [], packets: new Subject() };
			operations.push(operation);
			return {
				operation,
				emit: (filters: LazyFilter[]) => {
					operation.filters = filters;
				},
				over: vi.fn()
			};
		});
		mocks.use
			.mockReset()
			.mockImplementation(
				(req: { operation?: Operation }) => req.operation?.packets ?? forwardPackets
			);
		timeline = new HomeTimeline();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('keeps the single operation behavior', () => {
		timeline.older();

		expect(bounded()).toHaveLength(1);
		expectRange(bounded()[0], current - fetchWindow, current);

		const events = Array.from({ length: minTimelineLength }, (_, i) =>
			note(`event-${i}`, current - 100 - ((i * 7) % minTimelineLength))
		);
		send(bounded()[0], ...events);
		bounded()[0].packets.complete();

		expect(fetchEnough()).toHaveLength(0);
		expect(timeline.loading).toBe(false);
		expect(timeline.events.map((event) => event.created_at)).toEqual(
			events.map((event) => event.created_at).toSorted((x, y) => y - x)
		);
	});

	it('starts the first bounded REQ from the oldest event in the timeline', () => {
		timeline.subscribe();
		forwardPackets.next({ event: note('forward', current - 500), from: 'relay.example' });

		timeline.older();

		expectRange(bounded()[0], current - 500 - fetchWindow, current - 500);
	});

	it('starts bounded REQs up to two in parallel', () => {
		timeline.older();
		expect(bounded()).toHaveLength(1);
		expect(timeline.loading).toBe(false);

		timeline.older();
		expect(bounded()).toHaveLength(2);
		expect(timeline.loading).toBe(true);

		timeline.older();
		expect(bounded()).toHaveLength(2);

		bounded()[0].packets.complete();
		expect(fetchEnough()).toHaveLength(1);
		expect(timeline.loading).toBe(false);

		timeline.older();
		expect(bounded()).toHaveLength(3);
	});

	it('moves the cursor to since with the boundary timestamp overlapped', () => {
		timeline.older();
		timeline.older();

		expectRange(bounded()[0], current - fetchWindow, current);
		expectRange(bounded()[1], current - fetchWindow * 2, current - fetchWindow);
	});

	it('does not move the cursor forward when operations complete in reverse order', async () => {
		timeline.older();
		timeline.older();
		const [a, b] = bounded();
		const boundary = current - fetchWindow;

		send(b, note('b', boundary - 100));
		b.packets.complete();
		send(fetchEnough()[0], note('b-fetch-enough', boundary - 200));
		fetchEnough()[0].packets.complete();
		await flush();

		send(a, note('a', current - 10));
		a.packets.complete();
		send(fetchEnough()[1], note('a-fetch-enough', boundary - 300));
		fetchEnough()[1].packets.complete();
		await flush();

		timeline.older();

		expect(bounded()).toHaveLength(3);
		expectRange(bounded()[2], current - fetchWindow * 3, current - fetchWindow * 2);
	});

	it('corrects the cursor with the oldest event kept by fetchEnough', async () => {
		timeline.older();
		const [a] = bounded();
		const kept = note('a', current - 10);
		send(a, kept);
		a.packets.complete();

		const [operation] = fetchEnough();
		const limit = minTimelineLength - 1;
		expect(operation.filters[0]).toMatchObject({ until: current - 10, limit: limit * 2 });
		const older = Array.from({ length: limit + 5 }, (_, i) =>
			note(`fetch-enough-${i}`, current - fetchWindow * 2 - i)
		);
		send(operation, kept, ...older.toReversed());
		operation.packets.complete();
		await flush();

		expect(ids()).toEqual(['a', ...older.slice(0, limit).map((event) => event.id)]);

		timeline.older();

		expect(bounded()).toHaveLength(2);
		const until = older[limit - 1].created_at;
		expectRange(bounded()[1], until - fetchWindow, until);
	});

	it('keeps the cursor when fetchEnough returns no events', async () => {
		timeline.older();
		send(bounded()[0], note('a', current - 10));
		bounded()[0].packets.complete();
		fetchEnough()[0].packets.complete();
		await flush();

		timeline.older();

		expectRange(bounded()[1], current - fetchWindow * 2, current - fetchWindow);
	});

	it('merges fetchEnough results in reverse chronological order with parallel results', async () => {
		timeline.older();
		timeline.older();
		const [a, b] = bounded();
		const boundary = current - fetchWindow;
		const atBoundary = note('900', boundary);

		send(a, note('950', boundary + 50), atBoundary);
		a.packets.complete();
		send(
			b,
			atBoundary,
			note('850', boundary - 50),
			note('850', boundary - 50),
			note('810', boundary - 90)
		);

		const [operation] = fetchEnough();
		send(
			operation,
			note('850', boundary - 50),
			note('830', boundary - 70),
			note('800', boundary - 100),
			note('700', boundary - 200)
		);
		operation.packets.complete();
		await flush();

		send(b, note('750', boundary - 150));

		const expected = ['950', '900', '850', '830', '810', '800', '750', '700'];
		expect(ids()).toEqual(expected);
		expect(storedIds()).toEqual(expected);
	});

	it('restarts from the current time after clear', () => {
		timeline.older();
		timeline.older();

		timeline.clear();
		expect(timeline.loading).toBe(false);

		timeline.older();

		expectRange(bounded()[2], current - fetchWindow, current);
	});
});
