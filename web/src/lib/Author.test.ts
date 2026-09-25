import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY, of } from 'rxjs';
import type * as Nostr from 'nostr-typedef';

const mocks = vi.hoisted(() => ({
	cache: new Map<string, Nostr.Event>(),
	use: vi.fn(),
	put: vi.fn()
}));
vi.mock('./cache/Events', () => ({
	accountAddressableEventCache: {
		get: async (pubkey: string, kind: number, identifier = '') =>
			mocks.cache.get(`${pubkey}:${kind}:${identifier}`)
	},
	cacheAccountEvent: mocks.put
}));
vi.mock('./author/RelayList', () => ({ RelayList: { fetchEvents: vi.fn(), apply: vi.fn() } }));
vi.mock('./timelines/MainTimeline', () => ({
	rxNostr: { use: mocks.use },
	tie: <T>(source: T): T => source
}));
import { Author } from './Author';

const a = 'a'.repeat(64);
const b = 'b'.repeat(64);
function event(pubkey: string, kind = 3): Nostr.Event {
	return {
		id: `${pubkey}-${kind}`,
		pubkey,
		kind,
		created_at: 1,
		tags: [],
		content: '',
		sig: 'sig'
	};
}

beforeEach(() => {
	mocks.cache.clear();
	mocks.use.mockReset().mockReturnValue(EMPTY);
	mocks.put.mockReset().mockResolvedValue(true);
});

describe('Author.fetchEvents', () => {
	it('reads only the target account addresses and falls back to relay on a miss', async () => {
		mocks.cache.set(`${a}:3:`, event(a));
		const aResult = await new Author(a).fetchEvents();
		expect(aResult.replaceableEvents.get(3)).toEqual(event(a));
		expect(mocks.use).not.toHaveBeenCalled();

		const bResult = await new Author(b).fetchEvents();
		expect(bResult.replaceableEvents.size).toBe(0);
		expect(bResult.parameterizedReplaceableEvents.size).toBe(0);
		expect(mocks.use).toHaveBeenCalledOnce();
	});

	it('stores relay results in the event pubkey namespace', async () => {
		const bEvent = event(b);
		mocks.use.mockReturnValue(of({ event: bEvent, from: 'relay.example' }));
		const result = await new Author(b).fetchEvents();
		expect(result.replaceableEvents.get(3)).toEqual(bEvent);
		expect(mocks.put).toHaveBeenCalledWith(bEvent);
	});
});
