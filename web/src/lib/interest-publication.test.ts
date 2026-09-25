import { describe, expect, it, vi } from 'vitest';
import { EMPTY } from 'rxjs';
import { get } from 'svelte/store';
import type * as Nostr from 'nostr-typedef';

const send = vi.hoisted(() => vi.fn());
vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: { use: () => EMPTY, send },
	tie: <T>(source: T): T => source
}));
vi.mock('$lib/cache/Events', () => ({
	accountAddressableEventCache: { get: async () => undefined }
}));
vi.mock('$lib/auth.svelte', () => ({ auth: { pubkey: 'a'.repeat(64) } }));
import { followHashtag, followingHashtags } from './Interest';

describe('InterestsList publication ownership', () => {
	it('rejects a signed event from another pubkey before relay send or live state update', async () => {
		send.mockClear();
		followingHashtags.set(['existing']);
		const signEvent = vi.fn(async (unsigned: Nostr.UnsignedEvent): Promise<Nostr.Event> => ({
			...unsigned,
			id: 'wrong',
			pubkey: 'b'.repeat(64),
			sig: 'sig'
		}));
		await expect(followHashtag(signEvent, 'nostr')).rejects.toThrow('publication account');
		expect(send).not.toHaveBeenCalled();
		expect(get(followingHashtags)).toEqual(['existing']);
	});
});
