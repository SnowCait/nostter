import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Subject } from 'rxjs';

type RequestPacket = { event: { id: string; pubkey: string; content: string } };

const hoisted = vi.hoisted(() => ({
	streams: [] as Subject<RequestPacket>[],
	sendMock: vi.fn(),
	decryptNip44: vi.fn(async () => JSON.stringify({ id: 'req-1', method: 'ping', params: [] })),
	encryptNip44: vi.fn(async () => 'encrypted'),
	signEvent: vi.fn(async (event: unknown) => ({ ...(event as object), id: 'signed', sig: 'sig' }))
}));

vi.mock('rx-nostr', async (importOriginal) => {
	const actual = await importOriginal<typeof import('rx-nostr')>();
	return {
		...actual,
		createRxNostr: vi.fn(() => ({
			setDefaultRelays: vi.fn(),
			use: vi.fn(() => {
				const stream = new Subject<RequestPacket>();
				hoisted.streams.push(stream);
				return stream;
			}),
			send: hoisted.sendMock
		}))
	};
});

vi.mock('./stores/Author', async () => {
	const { writable } = await import('svelte/store');
	return { pubkey: writable('server-pubkey') };
});

vi.mock('./timelines/MainTimeline', () => ({
	verificationClient: { verifier: vi.fn() }
}));

vi.mock('$lib/platform/storage/persisted-store', () => ({
	persistedStore: (_key: string, initialValue: string) => {
		let value = initialValue;
		const subscribers = new Set<(value: string) => void>();
		return {
			subscribe(run: (value: string) => void) {
				run(value);
				subscribers.add(run);
				return () => subscribers.delete(run);
			},
			set(next: string) {
				value = next;
				subscribers.forEach((run) => run(value));
			},
			reset() {
				value = initialValue;
				subscribers.forEach((run) => run(value));
			},
			update(fn: (value: string) => string) {
				value = fn(value);
				subscribers.forEach((run) => run(value));
			}
		};
	}
}));

vi.mock('./Signer', () => ({
	Signer: {
		decryptNip44: hoisted.decryptNip44,
		encryptNip44: hoisted.encryptNip44,
		signEvent: hoisted.signEvent,
		getPublicKey: vi.fn(async () => 'server-pubkey'),
		encrypt: vi.fn(async () => 'encrypted'),
		decrypt: vi.fn(async () => 'decrypted')
	}
}));

import { remoteSigner } from './RemoteSigner';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const packet = (id: string): RequestPacket => ({
	event: { id, pubkey: 'client-pubkey', content: 'encrypted-request' }
});

beforeEach(() => {
	remoteSigner.disable();
	hoisted.streams.length = 0;
	hoisted.decryptNip44.mockClear();
	hoisted.encryptNip44.mockClear();
	hoisted.signEvent.mockClear();
	hoisted.sendMock.mockClear();
});

describe('RemoteSigner deduplication', () => {
	it('processes a request only once when the same event arrives from multiple relays', async () => {
		remoteSigner.enable();
		remoteSigner.subscribeIfEnabled();

		expect(hoisted.streams).toHaveLength(1);
		const stream = hoisted.streams[0];

		stream.next(packet('duplicate-id'));
		stream.next(packet('duplicate-id'));
		await flush();

		expect(hoisted.decryptNip44).toHaveBeenCalledTimes(1);
	});

	it('processes distinct events separately', async () => {
		remoteSigner.enable();
		remoteSigner.subscribeIfEnabled();

		const stream = hoisted.streams[0];
		stream.next(packet('id-a'));
		stream.next(packet('id-b'));
		await flush();

		expect(hoisted.decryptNip44).toHaveBeenCalledTimes(2);
	});
});

describe('RemoteSigner subscription idempotency', () => {
	it('does not create a new subscription when one is already active', () => {
		remoteSigner.enable();
		remoteSigner.subscribeIfEnabled();
		remoteSigner.subscribeIfEnabled();
		remoteSigner.subscribeIfEnabled();

		expect(hoisted.streams).toHaveLength(1);
		expect(hoisted.streams[0].observed).toBe(true);
	});

	it('does not subscribe when the remote signer is disabled', () => {
		remoteSigner.subscribeIfEnabled();

		expect(hoisted.streams).toHaveLength(0);
	});
});

describe('RemoteSigner re-subscription after disable', () => {
	it('closes the old subscription and creates a single new one', () => {
		remoteSigner.enable();
		remoteSigner.subscribeIfEnabled();
		const first = hoisted.streams[0];

		remoteSigner.disable();
		expect(first.observed).toBe(false);

		remoteSigner.enable();
		remoteSigner.subscribeIfEnabled();

		expect(hoisted.streams).toHaveLength(2);
		const second = hoisted.streams[1];
		expect(first.observed).toBe(false);
		expect(second.observed).toBe(true);
	});
});
