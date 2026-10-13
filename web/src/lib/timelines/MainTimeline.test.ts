import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filterLimitItems } from '$lib/Constants';
import { Metadata } from '$lib/Items';

const testState = vi.hoisted(() => ({
	requests: [] as Array<{
		emit: ReturnType<typeof vi.fn>;
		pipe: ReturnType<typeof vi.fn>;
	}>
}));

vi.mock('rx-nostr', () => ({
	batch: vi.fn(),
	createRxBackwardReq: vi.fn(() => {
		const request = {
			emit: vi.fn(),
			pipe: vi.fn()
		};
		testState.requests.push(request);
		return request;
	}),
	filterByType: vi.fn(),
	latestEach: vi.fn(),
	uniq: vi.fn()
}));

vi.mock('$lib/relay-client', () => ({
	rxNostr: {
		createConnectionStateObservable: vi.fn(() => ({ subscribe: vi.fn() })),
		createAllMessageObservable: vi.fn(() => ({
			pipe: vi.fn(() => ({ subscribe: vi.fn() }))
		})),
		getDefaultRelays: vi.fn(() => ({})),
		use: vi.fn(() => ({
			pipe: vi.fn(() => ({
				subscribe: vi.fn()
			}))
		}))
	}
}));

vi.mock('$lib/nostr/relay/relay-hints', () => ({
	tie: vi.fn(),
	seenOn: new Map(),
	getRelayHint: vi.fn(),
	getSeenOnRelays: vi.fn()
}));

vi.mock('$lib/nostr/verification/client', () => ({ verificationClient: {} }));
vi.mock('$lib/RelayList', () => ({ RelayList: { fetchEvents: vi.fn() } }));

vi.mock('../cache/Events', async () => {
	const { writable } = await import('svelte/store');
	return {
		eventItemStore: writable(new Map()),
		metadataStore: writable(new Map()),
		replaceableEventsStore: writable(new Map()),
		seenOnStore: writable(new Map()),
		storeEventItem: vi.fn(),
		storeMetadata: vi.fn()
	};
});

import { metadataStore } from '../cache/Events';
import { metadataReqEmit, referencesReqEmit } from './MainTimeline';
import { RelayList } from '$lib/RelayList';

function event(pubkey: string, createdAt = 0): Event {
	return {
		kind: 0,
		tags: [],
		content: '{}',
		created_at: createdAt,
		id: '',
		pubkey,
		sig: ''
	};
}

const metadataReq = testState.requests[0];

beforeEach(() => {
	metadataReq.emit.mockClear();
});

describe('metadataReqEmit', () => {
	it('requests cached metadata once per session and deduplicates an input', async () => {
		const pubkey = 'cached-pubkey';
		metadataStore.set(new Map([[pubkey, new Metadata(event(pubkey))]]));

		await metadataReqEmit([pubkey, pubkey]);
		await metadataReqEmit([pubkey]);

		expect(get(metadataStore).has(pubkey)).toBe(true);
		expect(metadataReq.emit).toHaveBeenCalledOnce();
		expect(metadataReq.emit).toHaveBeenCalledWith({ kinds: [0], authors: [pubkey] });
	});

	it('requests only unrequested pubkeys from a mixed list', async () => {
		const requestedPubkey = 'previously-requested-pubkey';
		const unrequestedPubkey = 'unrequested-pubkey';
		await metadataReqEmit([requestedPubkey]);
		metadataReq.emit.mockClear();

		await metadataReqEmit([requestedPubkey, unrequestedPubkey]);

		expect(metadataReq.emit).toHaveBeenCalledOnce();
		expect(metadataReq.emit).toHaveBeenCalledWith({
			kinds: [0],
			authors: [unrequestedPubkey]
		});
	});

	it('keeps metadata requests chunked by the filter item limit', async () => {
		const pubkeys = Array.from(
			{ length: filterLimitItems + 1 },
			(_, index) => `chunked-pubkey-${index}`
		);

		await metadataReqEmit(pubkeys);

		expect(metadataReq.emit).toHaveBeenCalledTimes(2);
		expect(metadataReq.emit.mock.calls[0][0].authors).toEqual(
			pubkeys.slice(0, filterLimitItems)
		);
		expect(metadataReq.emit.mock.calls[1][0].authors).toEqual(pubkeys.slice(filterLimitItems));
	});
});

describe('external relay discovery', () => {
	const references = testState.requests[1];
	const replaceable = testState.requests[2];
	const id = 'b'.repeat(64);
	const author = 'a'.repeat(64);
	const publicRelay = 'wss://relay.example.com/';
	beforeEach(() => {
		vi.useFakeTimers();
		references.emit.mockClear();
		replaceable.emit.mockClear();
	});
	afterEach(() => vi.useRealTimers());

	it('excludes non-public e and q relay hints before issuing relay-scoped requests', async () => {
		referencesReqEmit({
			...event(author),
			kind: 42,
			tags: [
				['e', id, 'wss://127.0.0.1/'],
				['q', id, 'wss://[::ffff:127.0.0.1]/'],
				['q', id, publicRelay]
			]
		});
		await vi.runAllTimersAsync();
		expect(references.emit.mock.calls.filter(([, scope]) => scope)).toEqual([
			[{ ids: [id] }, { relays: [publicRelay] }]
		]);
	});

	it('excludes non-public a and address q hints before issuing relay-scoped requests', () => {
		const address = `30023:${author}:article`;
		referencesReqEmit({
			...event(author),
			tags: [
				['a', address, 'wss://192.168.1.1/'],
				['q', address, 'wss://localhost/'],
				['a', address, publicRelay]
			]
		});
		expect(
			replaceable.emit.mock.calls.filter(([, scope]) => scope).map(([, scope]) => scope)
		).toEqual([{ relays: [publicRelay] }]);
	});

	it('excludes non-public relays advertised by other users kind 10002', async () => {
		const replyAuthor = 'd'.repeat(64);
		vi.mocked(RelayList.fetchEvents).mockResolvedValue(
			new Map([
				[
					author,
					{
						...event(author),
						kind: 10002,
						tags: [
							['r', 'wss://10.0.0.1/'],
							['r', publicRelay]
						]
					}
				],
				[
					replyAuthor,
					{ ...event(replyAuthor), kind: 10002, tags: [['r', 'wss://[fd00::1]/']] }
				]
			])
		);
		referencesReqEmit({
			...event(replyAuthor),
			kind: 1,
			tags: [['e', id, '', 'root', author]]
		});
		await vi.runAllTimersAsync();
		expect(references.emit.mock.calls.filter(([, scope]) => scope)).toEqual([
			[{ ids: [id] }, { relays: [publicRelay] }]
		]);
	});
});
