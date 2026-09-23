import type * as Nostr from 'nostr-typedef';
import { createRxNostr, type EventSigner } from 'rx-nostr';
import { describe, expect, it, vi } from 'vitest';
import type { Signer } from '$lib/nostr/signing/signer';
import { createRelayClient } from './client';

vi.mock('rx-nostr', () => ({
	Nip11Registry: { setDefault: vi.fn() },
	createRxNostr: vi.fn(() => ({})),
	now: vi.fn(() => 123)
}));

vi.mock('$lib/nostr/verification/client', () => ({
	verificationClient: { verifier: vi.fn() }
}));

function adapter(getSigner: () => Signer | undefined): EventSigner {
	createRelayClient(getSigner);
	const signer = vi.mocked(createRxNostr).mock.lastCall?.[0]?.signer;
	if (signer === undefined) {
		throw new Error('Missing relay signer adapter');
	}
	return signer;
}

function signer(pubkey: string): Signer {
	return {
		getPublicKey: vi.fn().mockResolvedValue(pubkey),
		signEvent: vi.fn().mockImplementation(async (params: Nostr.UnsignedEvent) => ({
			...params,
			id: pubkey,
			sig: 'signature'
		}))
	};
}

describe('relay signer adapter', () => {
	it('uses the current signer at each operation', async () => {
		const first = signer('first');
		const second = signer('second');
		let current: Signer | undefined = first;
		const getSigner = vi.fn(() => current);
		const relaySigner = adapter(getSigner);

		expect(getSigner).not.toHaveBeenCalled();
		await expect(relaySigner.getPublicKey()).resolves.toBe('first');
		current = second;
		await expect(relaySigner.getPublicKey()).resolves.toBe('second');
		await expect(relaySigner.signEvent({ kind: 1, content: 'hello' })).resolves.toMatchObject({
			id: 'second'
		});
		expect(first.signEvent).not.toHaveBeenCalled();
		expect(getSigner).toHaveBeenCalledTimes(3);
	});

	it('takes one signer snapshot and preserves event parameter defaults', async () => {
		const active = signer('active');
		const getSigner = vi.fn(() => active);
		const relaySigner = adapter(getSigner);

		await relaySigner.signEvent({ kind: 1, content: 'hello' });

		expect(getSigner).toHaveBeenCalledOnce();
		expect(active.signEvent).toHaveBeenCalledWith({
			kind: 1,
			content: 'hello',
			tags: [],
			created_at: 123
		});
	});

	it('returns a pre-signed event without requesting a signer', async () => {
		const getSigner = vi.fn(() => undefined);
		const relaySigner = adapter(getSigner);
		const event = {
			kind: 1,
			content: 'hello',
			tags: [],
			created_at: 1,
			pubkey: 'pubkey',
			id: 'id',
			sig: 'signature'
		} as Nostr.Event<1>;

		await expect(relaySigner.signEvent(event)).resolves.toBe(event);
		expect(getSigner).not.toHaveBeenCalled();
	});

	it('rejects operations that require a signer in an anonymous session', async () => {
		const relaySigner = adapter(() => undefined);

		await expect(relaySigner.getPublicKey()).rejects.toThrow('[logic error]');
		await expect(relaySigner.signEvent({ kind: 1, content: 'hello' })).rejects.toThrow(
			'[logic error]'
		);
	});
});
