import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Subject } from 'rxjs';
import type { Signer } from '$lib/nostr/signing/signer';

type RequestPacket = { event: { id: string; pubkey: string; content: string } };

const hoisted = vi.hoisted(() => ({
	streams: [] as Subject<RequestPacket>[],
	sendMock: vi.fn(),
	decryptNip44: vi.fn(async () => JSON.stringify({ id: 'req-1', method: 'ping', params: [] })),
	encryptNip44: vi.fn(async () => 'encrypted'),
	signEvent: vi.fn(async (event: Parameters<Signer['signEvent']>[0]) => ({
		...event,
		id: 'signed',
		pubkey: 'server-pubkey',
		sig: 'sig'
	}))
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

import { auth } from '$lib/auth.svelte';
import { remoteSigner } from './RemoteSigner';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const packet = (id: string): RequestPacket => ({
	event: { id, pubkey: 'client-pubkey', content: 'encrypted-request' }
});

beforeEach(() => {
	remoteSigner.disable();
	auth.reset();
	auth.establish({
		pubkey: 'server-pubkey',
		followingPubkeys: [],
		loginMethod: 'nsec',
		signer: {
			getPublicKey: vi.fn(async () => 'server-pubkey'),
			signEvent: hoisted.signEvent,
			nip44: {
				encrypt: hoisted.encryptNip44,
				decrypt: hoisted.decryptNip44
			}
		}
	});
	hoisted.streams.length = 0;
	hoisted.decryptNip44
		.mockReset()
		.mockResolvedValue(JSON.stringify({ id: 'req-1', method: 'ping', params: [] }));
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

describe('RemoteSigner request signer snapshot', () => {
	it('uses the current signer for each request and keeps it through a session change', async () => {
		remoteSigner.enable();
		const secret = new URL(remoteSigner.bunkerUrl).searchParams.get('secret');
		hoisted.decryptNip44.mockResolvedValueOnce(
			JSON.stringify({
				id: 'connect',
				method: 'connect',
				params: ['server-pubkey', secret]
			})
		);
		remoteSigner.subscribeIfEnabled();
		const stream = hoisted.streams[0];
		stream.next(packet('connect'));
		await flush();
		expect(hoisted.sendMock).toHaveBeenCalledTimes(1);

		const secondDecrypt = vi.fn(async () =>
			JSON.stringify({ id: 'later', method: 'ping', params: [] })
		);
		const secondEncrypt = vi.fn(async () => 'second-encrypted');
		const secondSignEvent = vi.fn(async (event: Parameters<Signer['signEvent']>[0]) => ({
			...event,
			id: 'second-signed',
			pubkey: 'server-pubkey',
			sig: 'sig'
		}));
		const secondSigner: Signer = {
			getPublicKey: vi.fn(async () => 'server-pubkey'),
			signEvent: secondSignEvent,
			nip44: { decrypt: secondDecrypt, encrypt: secondEncrypt }
		};
		hoisted.decryptNip44.mockImplementationOnce(async () => {
			auth.establish({
				pubkey: 'server-pubkey',
				followingPubkeys: [],
				loginMethod: 'nsec',
				signer: secondSigner
			});
			return JSON.stringify({
				id: 'sign',
				method: 'sign_event',
				params: [JSON.stringify({ kind: 1, content: 'test', tags: [], created_at: 1 })]
			});
		});
		hoisted.signEvent.mockClear();
		hoisted.encryptNip44.mockClear();

		stream.next(packet('sign'));
		await flush();

		expect(hoisted.decryptNip44).toHaveBeenCalledTimes(2);
		expect(hoisted.signEvent).toHaveBeenCalledTimes(2);
		expect(hoisted.signEvent.mock.calls[0][0]).toMatchObject({ kind: 1 });
		expect(hoisted.signEvent.mock.calls[1][0]).toMatchObject({ kind: 24133 });
		expect(hoisted.encryptNip44).toHaveBeenCalledOnce();
		expect(secondDecrypt).not.toHaveBeenCalled();
		expect(secondEncrypt).not.toHaveBeenCalled();
		expect(secondSignEvent).not.toHaveBeenCalled();
		expect(hoisted.sendMock).toHaveBeenCalledTimes(2);

		stream.next(packet('later'));
		await flush();

		expect(secondDecrypt).toHaveBeenCalledOnce();
		expect(secondEncrypt).toHaveBeenCalledOnce();
		expect(secondSignEvent).toHaveBeenCalledOnce();
		expect(hoisted.sendMock).toHaveBeenCalledTimes(3);
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
