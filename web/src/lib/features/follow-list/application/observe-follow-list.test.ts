import { describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools/core';
import { Contacts } from 'nostr-tools/kinds';
import { Observable, Subject } from 'rxjs';
import { createFollowListObserver, observeFollowList } from './observe-follow-list';

const mocks = vi.hoisted(() => ({
	getLatest: vi.fn(),
	cacheFolloweeReplaceableEvent: vi.fn(),
	requestLatestReplaceableEvent: vi.fn(),
	followeesSet: new Set<string>()
}));

vi.mock('$lib/auth.svelte', () => ({
	auth: { followeesSet: mocks.followeesSet }
}));
vi.mock('$lib/cache/Events', () => ({
	followeeEventCache: { getLatest: mocks.getLatest },
	cacheFolloweeReplaceableEvent: mocks.cacheFolloweeReplaceableEvent
}));
vi.mock('$lib/nostr/relay/event-operations', () => ({
	requestLatestReplaceableEvent: mocks.requestLatestReplaceableEvent
}));

const target = 'a'.repeat(64);

function followList(createdAt: number, pubkey = target): Event {
	return {
		id: createdAt.toString(16).padStart(64, '0'),
		pubkey,
		kind: Contacts,
		tags: [],
		content: '',
		created_at: createdAt,
		sig: ''
	};
}

function relayStub() {
	const requests: Subject<Event>[] = [];
	const unsubscribed = vi.fn();
	const request = vi.fn(
		() =>
			new Observable<Event>((subscriber) => {
				const subject = new Subject<Event>();
				requests.push(subject);
				const subscription = subject.subscribe(subscriber);
				return () => {
					unsubscribed();
					subscription.unsubscribe();
				};
			})
	);
	return { requests, request, unsubscribed };
}

function setup(cached?: Event) {
	const relay = relayStub();
	const getCachedFolloweeEvent = vi.fn(async () => cached);
	const cache = vi.fn();
	const observe = createFollowListObserver({
		getCachedFolloweeEvent,
		request: relay.request,
		cache
	});
	return { observe, cache, ...relay };
}

function collect(source: Observable<Event>) {
	const result = { values: [] as Event[], completed: false, error: undefined as unknown };
	const subscription = source.subscribe({
		next: (event) => result.values.push(event),
		complete: () => (result.completed = true),
		error: (error) => (result.error = error)
	});
	return Object.assign(result, { subscription });
}

async function startRequest(observe: (pubkey: string) => Observable<Event>, requests: unknown[]) {
	const result = collect(observe(target));
	await vi.waitFor(() => expect(requests).toHaveLength(1));
	return result;
}

describe('createFollowListObserver', () => {
	it('requests from relays on the first use in a session', async () => {
		const { observe, requests, request, cache } = setup();

		const { values } = await startRequest(observe, requests);
		const event = followList(1);
		requests[0].next(event);

		expect(request).toHaveBeenCalledWith(target);
		expect(values).toEqual([event]);
		expect(cache).toHaveBeenCalledWith(event);
	});

	it('emits a cached followee event before the relay request and still requests', async () => {
		const cached = followList(1);
		const { observe, requests } = setup(cached);

		const { values } = await startRequest(observe, requests);

		expect(values).toEqual([cached]);
		expect(requests).toHaveLength(1);
	});

	it('replaces the cached event with a newer relay event without regressing', async () => {
		const { observe, requests, cache } = setup(followList(2));

		const { values } = await startRequest(observe, requests);
		requests[0].next(followList(1));
		requests[0].next(followList(3));
		requests[0].next(followList(2));

		expect(values).toEqual([followList(2), followList(3)]);
		expect(cache).toHaveBeenCalledExactlyOnceWith(followList(3));
	});

	it('does not request again after a completed request', async () => {
		const { observe, requests, request } = setup();

		await startRequest(observe, requests);
		const event = followList(1);
		requests[0].next(event);
		requests[0].complete();

		const second = collect(observe(target));

		expect(second.values).toEqual([event]);
		expect(second.completed).toBe(true);
		expect(request).toHaveBeenCalledOnce();
	});

	it('does not request again after a completed request without events', async () => {
		const { observe, requests, request } = setup();

		await startRequest(observe, requests);
		requests[0].complete();

		const second = collect(observe(target));

		expect(second.values).toEqual([]);
		expect(second.completed).toBe(true);
		expect(request).toHaveBeenCalledOnce();
	});

	it('shares a concurrent request and replays the latest event to late subscribers', async () => {
		const { observe, requests, request } = setup();

		const first = await startRequest(observe, requests);
		const event = followList(1);
		requests[0].next(event);
		const late = collect(observe(target));
		const newer = followList(2);
		requests[0].next(newer);

		expect(request).toHaveBeenCalledOnce();
		expect(first.values).toEqual([event, newer]);
		expect(late.values).toEqual([event, newer]);
	});

	it('requests again after the last subscriber cancels, keeping the received event', async () => {
		const { observe, requests, request, unsubscribed } = setup();

		const first = await startRequest(observe, requests);
		const event = followList(1);
		requests[0].next(event);
		first.subscription.unsubscribe();

		expect(unsubscribed).toHaveBeenCalledOnce();

		const second = collect(observe(target));
		await vi.waitFor(() => expect(requests).toHaveLength(2));

		expect(request).toHaveBeenCalledTimes(2);
		expect(second.values).toEqual([event]);
	});

	it('requests again after an error', async () => {
		const { observe, requests, request } = setup();

		const first = await startRequest(observe, requests);
		const error = new Error('relay failed');
		requests[0].error(error);

		expect(first.error).toBe(error);

		collect(observe(target));
		await vi.waitFor(() => expect(requests).toHaveLength(2));

		expect(request).toHaveBeenCalledTimes(2);
	});
});

describe('observeFollowList', () => {
	it('uses and updates the followee cache for a followee', async () => {
		const pubkey = 'b'.repeat(64);
		const cached = followList(1, pubkey);
		const newer = followList(2, pubkey);
		const relay = relayStub();
		mocks.followeesSet.add(pubkey);
		mocks.getLatest.mockResolvedValue(new Map([[pubkey, cached]]));
		mocks.requestLatestReplaceableEvent.mockImplementation(() => relay.request());

		const { values } = collect(observeFollowList(pubkey));
		await vi.waitFor(() => expect(relay.requests).toHaveLength(1));
		relay.requests[0].next(newer);

		expect(mocks.getLatest).toHaveBeenCalledWith(Contacts, [pubkey]);
		expect(mocks.requestLatestReplaceableEvent).toHaveBeenCalledWith(Contacts, pubkey);
		expect(values).toEqual([cached, newer]);
		expect(mocks.cacheFolloweeReplaceableEvent).toHaveBeenCalledWith(newer);
	});

	it('does not read the followee cache for a non-followee', async () => {
		const pubkey = 'c'.repeat(64);
		const relay = relayStub();
		mocks.getLatest.mockClear();
		mocks.requestLatestReplaceableEvent.mockImplementation(() => relay.request());

		collect(observeFollowList(pubkey));
		await vi.waitFor(() => expect(relay.requests).toHaveLength(1));

		expect(mocks.getLatest).not.toHaveBeenCalled();
	});
});
