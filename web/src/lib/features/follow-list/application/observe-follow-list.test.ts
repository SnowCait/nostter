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

function setup() {
	const relay = relayStub();
	const cacheRead = Promise.withResolvers<Event | undefined>();
	const getCachedFolloweeEvent = vi.fn(() => cacheRead.promise);
	const cache = vi.fn();
	const observe = createFollowListObserver({
		getCachedFolloweeEvent,
		request: relay.request,
		cache
	});
	return { observe, cacheRead, cache, ...relay };
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

async function settle(promise: Promise<unknown>) {
	await promise.catch(() => {});
	await new Promise((resolve) => setTimeout(resolve));
}

describe('createFollowListObserver', () => {
	it('starts the relay request without waiting for the cache read', () => {
		const { observe, requests, request, cache } = setup();

		const { values } = collect(observe(target));
		const event = followList(1);
		requests[0].next(event);

		expect(request).toHaveBeenCalledExactlyOnceWith(target);
		expect(values).toEqual([event]);
		expect(cache).toHaveBeenCalledWith(event);
	});

	it('emits a cached event that arrives first and still requests', async () => {
		const { observe, cacheRead, requests } = setup();

		const { values } = collect(observe(target));
		const cached = followList(1);
		cacheRead.resolve(cached);
		await settle(cacheRead.promise);
		const newer = followList(2);
		requests[0].next(newer);

		expect(requests).toHaveLength(1);
		expect(values).toEqual([cached, newer]);
	});

	it('does not regress to an older cached event that arrives after the relay event', async () => {
		const { observe, cacheRead, requests, cache } = setup();

		const { values } = collect(observe(target));
		const newer = followList(2);
		requests[0].next(newer);
		cacheRead.resolve(followList(1));
		await settle(cacheRead.promise);
		requests[0].next(followList(1));

		expect(values).toEqual([newer]);
		expect(cache).toHaveBeenCalledExactlyOnceWith(newer);
	});

	it('keeps requesting when the cache read fails', async () => {
		const { observe, cacheRead, requests } = setup();
		vi.spyOn(console, 'warn').mockImplementation(() => {});

		const result = collect(observe(target));
		cacheRead.reject(new Error('read failed'));
		await settle(cacheRead.promise);
		const event = followList(1);
		requests[0].next(event);
		requests[0].complete();

		expect(result.error).toBeUndefined();
		expect(result.values).toEqual([event]);
		expect(result.completed).toBe(true);
	});

	it('does not request again after the relay request completes', async () => {
		const { observe, cacheRead, requests, request } = setup();

		collect(observe(target));
		const event = followList(1);
		requests[0].next(event);
		requests[0].complete();
		cacheRead.resolve(undefined);
		await settle(cacheRead.promise);

		const second = collect(observe(target));

		expect(second.values).toEqual([event]);
		expect(second.completed).toBe(true);
		expect(request).toHaveBeenCalledOnce();
	});

	it('does not request again after the relay request completes without events', () => {
		const { observe, requests, request } = setup();

		collect(observe(target));
		requests[0].complete();

		const second = collect(observe(target));

		expect(second.values).toEqual([]);
		expect(second.completed).toBe(true);
		expect(request).toHaveBeenCalledOnce();
	});

	it('shares a concurrent request and replays the latest event to late subscribers', () => {
		const { observe, requests, request } = setup();

		const first = collect(observe(target));
		const event = followList(1);
		requests[0].next(event);
		const late = collect(observe(target));
		const newer = followList(2);
		requests[0].next(newer);

		expect(request).toHaveBeenCalledOnce();
		expect(first.values).toEqual([event, newer]);
		expect(late.values).toEqual([event, newer]);
	});

	it('requests again after the last subscriber cancels, keeping the received event', () => {
		const { observe, requests, request, unsubscribed } = setup();

		const first = collect(observe(target));
		const event = followList(1);
		requests[0].next(event);
		first.subscription.unsubscribe();

		expect(unsubscribed).toHaveBeenCalledOnce();

		const second = collect(observe(target));

		expect(request).toHaveBeenCalledTimes(2);
		expect(second.values).toEqual([event]);
	});

	it('requests again after a relay error', () => {
		const { observe, requests, request } = setup();

		const first = collect(observe(target));
		const error = new Error('relay failed');
		requests[0].error(error);

		expect(first.error).toBe(error);

		collect(observe(target));

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
		await vi.waitFor(() => expect(values).toEqual([cached]));
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
		await new Promise((resolve) => setTimeout(resolve));

		expect(relay.requests).toHaveLength(1);
		expect(mocks.getLatest).not.toHaveBeenCalled();
	});
});
