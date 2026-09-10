import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY, Subject } from 'rxjs';
import type * as Nostr from 'nostr-typedef';

const mocks = vi.hoisted(() => ({
	userPubkey: 'f'.repeat(64),
	signEvent: vi.fn(),
	send: vi.fn()
}));

vi.mock('$lib/stores/Author', async () => {
	const { writable } = await import('svelte/store');
	return { pubkey: writable(mocks.userPubkey) };
});
vi.mock('$lib/Signer', () => ({ Signer: { signEvent: mocks.signEvent } }));
vi.mock('$lib/timelines/MainTimeline', () => ({ rxNostr: { send: mocks.send } }));

import { requestEventDeletion } from './Delete';

function event(id: string, kind: number, pubkey = mocks.userPubkey): Nostr.Event {
	return { id, kind, pubkey, content: '', tags: [], created_at: 1, sig: 'sig' };
}

beforeEach(() => {
	vi.resetAllMocks();
	mocks.signEvent.mockImplementation(async (unsigned: Nostr.UnsignedEvent) => ({
		...unsigned,
		id: 'deletion-request',
		sig: 'sig'
	}));
});

describe('requestEventDeletion', () => {
	it('signs a kind 5 request and waits for a relay acceptance', async () => {
		const responses = new Subject<{ ok: boolean }>();
		mocks.send.mockReturnValue(responses);
		let resolved = false;
		const request = requestEventDeletion(
			[event('first', 1), event('second', 7), event('third', 1)],
			'duplicate'
		).then(() => {
			resolved = true;
		});

		await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
		expect(mocks.signEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: 5,
				pubkey: mocks.userPubkey,
				content: 'duplicate',
				tags: [
					['e', 'first'],
					['e', 'second'],
					['e', 'third'],
					['k', '1'],
					['k', '7']
				]
			})
		);

		responses.next({ ok: false });
		await Promise.resolve();
		expect(resolved).toBe(false);

		responses.next({ ok: true });
		await expect(request).resolves.toBeUndefined();
	});

	it('rejects when no relay accepts the request', async () => {
		mocks.send.mockReturnValue(EMPTY);

		await expect(requestEventDeletion([event('first', 1)])).rejects.toThrow();
	});

	it('rejects invalid deletion targets', async () => {
		await expect(requestEventDeletion([])).rejects.toThrow();
		await expect(requestEventDeletion([event('first', 1, 'another-author')])).rejects.toThrow();
		expect(mocks.signEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});
});
