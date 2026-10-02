import { describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools/core';
import { Contacts } from 'nostr-tools/kinds';
import { Observable, Subject } from 'rxjs';
import { createFollowListObserver, isFollowing } from './follow-list';

vi.mock('$lib/cache/Events', () => ({
	accountAddressableEventCache: { get: vi.fn() },
	cacheAccountEvent: vi.fn()
}));
vi.mock('$lib/nostr/relay/event-operations', () => ({
	requestLatestReplaceableEvent: vi.fn()
}));

const target = 'a'.repeat(64);
const account = 'b'.repeat(64);

function followList(createdAt: number, pubkeys: string[] = []): Event {
	return {
		id: createdAt.toString(16).padStart(64, '0'),
		pubkey: target,
		kind: Contacts,
		tags: pubkeys.map((pubkey) => ['p', pubkey]),
		content: '',
		created_at: createdAt,
		sig: ''
	};
}

function setup(cached?: Event) {
	const requests: Subject<Event>[] = [];
	const unsubscribed = vi.fn();
	const getCached = vi.fn(async () => cached);
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
	const cache = vi.fn(async () => true);
	const observe = createFollowListObserver({ getCached, request, cache });
	return { observe, requests, unsubscribed, getCached, request, cache };
}

function collect(source: Observable<Event>) {
	const values: Event[] = [];
	const subscription = source.subscribe((event) => values.push(event));
	return { values, subscription };
}

describe('createFollowListObserver', () => {
	it('uses the cached follow list without a relay request', async () => {
		const cached = followList(1);
		const { observe, request } = setup(cached);

		const { values } = collect(observe(target));
		await vi.waitFor(() => expect(values).toEqual([cached]));

		expect(request).not.toHaveBeenCalled();
	});

	it('requests and caches the follow list on a cache miss', async () => {
		const { observe, requests, request, cache } = setup();

		const { values } = collect(observe(target));
		await vi.waitFor(() => expect(requests).toHaveLength(1));
		const event = followList(1);
		requests[0].next(event);

		expect(request).toHaveBeenCalledWith(target);
		expect(values).toEqual([event]);
		expect(cache).toHaveBeenCalledWith(event);
	});

	it('shares a concurrent request for the same pubkey', async () => {
		const { observe, requests, request } = setup();

		const first = collect(observe(target));
		const second = collect(observe(target));
		await vi.waitFor(() => expect(requests).toHaveLength(1));
		const event = followList(1);
		requests[0].next(event);

		expect(request).toHaveBeenCalledOnce();
		expect(first.values).toEqual([event]);
		expect(second.values).toEqual([event]);
	});

	it('keeps sharing a completed request until its cache write settles', async () => {
		const { observe, requests, request, cache } = setup();
		const write = Promise.withResolvers<boolean>();
		cache.mockReturnValueOnce(write.promise);

		collect(observe(target));
		await vi.waitFor(() => expect(requests).toHaveLength(1));
		const event = followList(1);
		requests[0].next(event);
		requests[0].complete();

		const late = collect(observe(target));
		await vi.waitFor(() => expect(late.values).toEqual([event]));
		expect(request).toHaveBeenCalledOnce();

		write.resolve(true);
		await new Promise((resolve) => setTimeout(resolve));
		collect(observe(target));
		await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
	});

	it('does not regress to an older follow list', async () => {
		const { observe, requests } = setup();

		const { values } = collect(observe(target));
		await vi.waitFor(() => expect(requests).toHaveLength(1));
		const newer = followList(2);
		requests[0].next(newer);
		requests[0].next(followList(1));

		expect(values).toEqual([newer]);
	});

	it('cancels the request when the last subscriber unsubscribes', async () => {
		const { observe, requests, unsubscribed } = setup();

		const { values, subscription } = collect(observe(target));
		await vi.waitFor(() => expect(requests).toHaveLength(1));
		subscription.unsubscribe();
		requests[0].next(followList(1));

		expect(unsubscribed).toHaveBeenCalledOnce();
		expect(values).toEqual([]);
	});

	it('does not request after unsubscribing during the cache lookup', async () => {
		const { observe, getCached, request } = setup();

		const { subscription } = collect(observe(target));
		subscription.unsubscribe();
		await getCached.mock.results[0].value;

		expect(request).not.toHaveBeenCalled();
	});
});

describe('isFollowing', () => {
	it('checks the follow list for the pubkey', () => {
		expect(isFollowing(followList(1, [account]), account)).toBe(true);
		expect(isFollowing(followList(1, ['c'.repeat(64)]), account)).toBe(false);
	});
});
