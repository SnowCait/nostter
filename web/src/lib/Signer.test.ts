import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event, EventTemplate } from 'nostr-tools';
import { auth } from './auth.svelte';
import type { Signer as SigningSigner } from './nostr/signing/signer';
import { Signer } from './Signer';

afterEach(() => {
	auth.reset();
	vi.clearAllMocks();
});

describe('Signer facade', () => {
	it('throws a logic error for both operations in an anonymous session', async () => {
		await expect(Signer.getPublicKey()).rejects.toThrow('[logic error]');
		await expect(Signer.signEvent({} as EventTemplate)).rejects.toThrow('[logic error]');
	});

	it('throws a logic error in an authenticated session without a signer', async () => {
		auth.establish('pubkey', [], undefined);

		await expect(Signer.getPublicKey()).rejects.toThrow('[logic error]');
	});

	it('throws a logic error after the session is reset', async () => {
		auth.establish('pubkey', [], { getPublicKey: vi.fn(), signEvent: vi.fn() });
		auth.reset();

		await expect(Signer.getPublicKey()).rejects.toThrow('[logic error]');
	});

	it('delegates both operations to the attached signer instance', async () => {
		const signedEvent = { id: 'event' } as Event;
		const signer = {
			getPublicKey: vi.fn().mockResolvedValue('pubkey'),
			signEvent: vi.fn().mockResolvedValue(signedEvent)
		} satisfies SigningSigner;
		const unsignedEvent = { kind: 1 } as EventTemplate;
		auth.establish('pubkey', [], signer);

		await expect(Signer.getPublicKey()).resolves.toBe('pubkey');
		await expect(Signer.signEvent(unsignedEvent)).resolves.toBe(signedEvent);

		expect(signer.signEvent).toHaveBeenCalledWith(unsignedEvent);
	});
});
