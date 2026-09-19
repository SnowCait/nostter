import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	pubkey: 'f'.repeat(64),
	followee: 'a'.repeat(64),
	fetchRelays: vi.fn().mockResolvedValue(undefined),
	fetchEvents: vi.fn(),
	updateFollowees: vi.fn(),
	loadFolloweesMetadataCache: vi.fn().mockResolvedValue(undefined),
	pruneFolloweeReplaceableEventsCache: vi.fn(),
	authorSet: vi.fn()
}));

vi.mock('$lib/Author', () => ({
	Author: class {
		constructor(public pubkey: string) {}
		fetchRelays = mocks.fetchRelays;
		fetchEvents = mocks.fetchEvents;
	}
}));

vi.mock('$lib/stores/Author', () => ({
	author: { set: mocks.authorSet }
}));

vi.mock('$lib/auth.svelte', () => ({
	auth: {
		get followees() {
			return [mocks.followee, mocks.pubkey];
		},
		updateFollowees: mocks.updateFollowees
	}
}));

vi.mock('$lib/cache/Events', () => ({
	loadFolloweesMetadataCache: mocks.loadFolloweesMetadataCache,
	pruneFolloweeReplaceableEventsCache: mocks.pruneFolloweeReplaceableEventsCache
}));

import { initializeAccount } from './initialize-account';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.fetchRelays.mockResolvedValue(undefined);
	mocks.fetchEvents.mockResolvedValue([['p', mocks.followee]]);
	mocks.loadFolloweesMetadataCache.mockResolvedValue(undefined);
});

describe('initializeAccount', () => {
	it('fetches relays before fetching events', async () => {
		const order: string[] = [];
		mocks.fetchRelays.mockImplementation(async () => {
			order.push('fetchRelays');
		});
		mocks.fetchEvents.mockImplementation(async () => {
			order.push('fetchEvents');
			return [['p', mocks.followee]];
		});

		await initializeAccount(mocks.pubkey);

		expect(order).toEqual(['fetchRelays', 'fetchEvents']);
	});

	it('updates followees from the fetched contacts tags', async () => {
		const tags = [['p', mocks.followee]];
		mocks.fetchEvents.mockResolvedValue(tags);

		await initializeAccount(mocks.pubkey);

		expect(mocks.updateFollowees).toHaveBeenCalledWith(tags, mocks.pubkey);
	});

	it('initializes the followee metadata cache and prunes it using the updated followees', async () => {
		await initializeAccount(mocks.pubkey);

		expect(mocks.loadFolloweesMetadataCache).toHaveBeenCalledWith([
			mocks.followee,
			mocks.pubkey
		]);
		expect(mocks.pruneFolloweeReplaceableEventsCache).toHaveBeenCalledWith([
			mocks.followee,
			mocks.pubkey
		]);
	});

	it('publishes the initialized author to the author store', async () => {
		await initializeAccount(mocks.pubkey);

		expect(mocks.authorSet).toHaveBeenCalledOnce();
		const publishedAuthor = mocks.authorSet.mock.calls[0][0];
		expect(publishedAuthor.pubkey).toBe(mocks.pubkey);
	});
});
