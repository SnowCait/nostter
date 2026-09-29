import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Nostr from 'nostr-typedef';

const mocks = vi.hoisted(() => ({
	cache: new Map<string, Nostr.Event>(),
	fetchEvents: vi.fn(),
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
vi.mock('./nostr/relay/event-operations', () => ({ fetchEvents: mocks.fetchEvents }));
import { Author } from './Author';
import { parameterizedReplaceableKinds, replaceableKinds } from './Constants';

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
	mocks.fetchEvents.mockReset().mockResolvedValue([]);
	mocks.put.mockReset().mockResolvedValue(true);
});

describe('Author.fetchEvents', () => {
	it('reads only the target account addresses and falls back to relay on a miss', async () => {
		mocks.cache.set(`${a}:3:`, event(a));
		const aResult = await new Author(a).fetchEvents();
		expect(aResult.replaceableEvents.get(3)).toEqual(event(a));
		expect(mocks.fetchEvents).not.toHaveBeenCalled();

		const bResult = await new Author(b).fetchEvents();
		expect(bResult.replaceableEvents.size).toBe(0);
		expect(bResult.parameterizedReplaceableEvents.size).toBe(0);
		expect(mocks.fetchEvents).toHaveBeenCalledExactlyOnceWith([
			{ kinds: [...replaceableKinds, ...parameterizedReplaceableKinds], authors: [b] }
		]);
	});

	it('stores relay results in the event pubkey namespace', async () => {
		const bEvent = event(b);
		mocks.fetchEvents.mockResolvedValue([bEvent]);
		const result = await new Author(b).fetchEvents();
		expect(result.replaceableEvents.get(3)).toEqual(bEvent);
		expect(mocks.put).toHaveBeenCalledWith(bEvent);
	});

	it('keeps and caches only the NIP-01 latest event for each replaceable kind and address', async () => {
		const version = (
			kind: number,
			created_at: number,
			id: string,
			identifier?: string
		): Nostr.Event => ({
			...event(b, kind),
			id,
			created_at,
			tags: identifier === undefined ? [] : [['d', identifier]]
		});
		const olderContacts = version(3, 1, 'a');
		const tiedContacts = version(3, 2, 'c');
		const contacts = version(3, 2, 'b');
		const tiedMutedByKind6 = version(30007, 2, 'e', '6');
		const olderMutedByKind6 = version(30007, 1, 'a', '6');
		const mutedByKind6 = version(30007, 2, 'd', '6');
		const mutedByKind7 = version(30007, 1, 'f', '7');
		mocks.fetchEvents.mockResolvedValue([
			olderContacts,
			tiedContacts,
			contacts,
			tiedMutedByKind6,
			olderMutedByKind6,
			mutedByKind6,
			mutedByKind7
		]);

		const result = await new Author(b).fetchEvents();

		expect([...result.replaceableEvents]).toEqual([[3, contacts]]);
		expect([...result.parameterizedReplaceableEvents]).toEqual([
			['30007:6', mutedByKind6],
			['30007:7', mutedByKind7]
		]);
		expect(mocks.put.mock.calls).toEqual([[contacts], [mutedByKind6], [mutedByKind7]]);
	});
});
