import { get } from 'svelte/store';
import { of, throwError } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	sent: [] as Nostr.Event[],
	fails: false,
	signEvent: vi.fn(async (event) => ({ ...event, id: 'deletion', sig: 'sig' }))
}));

vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: {
		send: (event: Nostr.Event) => {
			mocks.sent.push(event);
			return mocks.fails ? throwError(() => new Error('failed')) : of({ ok: true });
		}
	}
}));
vi.mock('$lib/Signer', () => ({ Signer: { signEvent: mocks.signEvent } }));
vi.mock('$lib/stores/Author', async () => {
	const { writable } = await import('svelte/store');
	return { pubkey: writable('author') };
});

import { deleteAddressableEvent, deletedEventCoordinates } from './Delete';

describe('deleteAddressableEvent', () => {
	beforeEach(() => {
		mocks.sent = [];
		mocks.fails = false;
		mocks.signEvent.mockClear();
		deletedEventCoordinates.set(new Set());
	});

	it('publishes only a NIP-09 address deletion request and records relay success', async () => {
		await deleteAddressableEvent(30001, 'author', 'bookmark');

		expect(mocks.signEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: 5,
				tags: [
					['a', '30001:author:bookmark'],
					['k', '30001']
				]
			})
		);
		expect(mocks.sent).toHaveLength(1);
		expect(mocks.sent[0].kind).toBe(5);
		expect(get(deletedEventCoordinates)).toContain('30001:author:bookmark');
	});

	it('does not record deletion when no relay accepts the request', async () => {
		mocks.fails = true;
		await expect(deleteAddressableEvent(30001, 'author', 'bookmark')).rejects.toThrow();
		expect(get(deletedEventCoordinates)).not.toContain('30001:author:bookmark');
	});
});
