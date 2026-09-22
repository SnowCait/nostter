import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { filterLimitItems } from '$lib/Constants';
import { Metadata } from '$lib/Items';

const testState = vi.hoisted(() => ({
	requests: [] as Array<{
		emit: ReturnType<typeof vi.fn>;
		pipe: ReturnType<typeof vi.fn>;
	}>,
	requestSubscribers: [] as Array<(packet: { event: Event }) => void>,
	storeMetadata: vi.fn()
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

vi.mock('$lib/nostr/relay/client', () => ({
	rxNostr: {
		createConnectionStateObservable: vi.fn(() => ({ subscribe: vi.fn() })),
		createAllMessageObservable: vi.fn(() => ({
			pipe: vi.fn(() => ({ subscribe: vi.fn() }))
		})),
		getDefaultRelays: vi.fn(() => ({})),
		use: vi.fn(() => ({
			pipe: vi.fn(() => ({
				subscribe: vi.fn((subscriber: (packet: { event: Event }) => void) => {
					testState.requestSubscribers.push(subscriber);
				})
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
		storeMetadata: testState.storeMetadata
	};
});

import { metadataStore } from '../cache/Events';
import { metadataReqEmit } from './MainTimeline';

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
	testState.storeMetadata.mockClear();
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

	it('stores metadata received by the metadata request subscription', () => {
		const receivedEvent = event('received-pubkey', 1);

		testState.requestSubscribers[0]({ event: receivedEvent });

		expect(testState.storeMetadata).toHaveBeenCalledOnce();
		expect(testState.storeMetadata).toHaveBeenCalledWith(receivedEvent);
	});
});
