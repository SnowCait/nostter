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
vi.mock('$lib/nostr/relay/client', () => ({ rxNostr: { send: mocks.send } }));

import { requestEventDeletion } from './request-event-deletion';

function event(
	id: string,
	kind: number,
	pubkey = mocks.userPubkey,
	tags: string[][] = []
): Nostr.Event {
	return { id, kind, pubkey, content: '', tags, created_at: 1, sig: 'sig' };
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
	it('signs a mixed kind 5 request and waits for a relay acceptance', async () => {
		const responses = new Subject<{ ok: boolean }>();
		mocks.send.mockReturnValue(responses);
		let resolved = false;
		const request = requestEventDeletion(
			[
				event('regular', 1),
				event('replaceable', 10003, mocks.userPubkey, [['d', 'ignored']]),
				event('newer-replaceable', 10003, mocks.userPubkey, [['d', 'also-ignored']]),
				event('addressable', 30001, mocks.userPubkey, [['d', 'bookmark']]),
				event('newer-addressable', 30001, mocks.userPubkey, [['d', 'bookmark']])
			],
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
					['e', 'regular'],
					['a', `10003:${mocks.userPubkey}:`],
					['a', `30001:${mocks.userPubkey}:bookmark`],
					['k', '1'],
					['k', '10003'],
					['k', '30001']
				]
			})
		);

		responses.next({ ok: false });
		await Promise.resolve();
		expect(resolved).toBe(false);

		responses.next({ ok: true });
		await expect(request).resolves.toBeUndefined();
		expect(responses.observed).toBe(true);
		responses.complete();
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
