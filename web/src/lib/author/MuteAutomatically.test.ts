import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { kinds as Kind } from 'nostr-tools';

const mocks = vi.hoisted(() => ({
	emit: vi.fn(),
	over: vi.fn(),
	use: vi.fn(),
	getLatest: vi.fn()
}));

vi.mock('rx-nostr', () => ({
	createRxBackwardReq: () => ({ emit: mocks.emit, over: mocks.over }),
	latestEach: vi.fn(),
	uniq: vi.fn()
}));
vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: { use: mocks.use },
	tie: vi.fn()
}));
vi.mock('$lib/cache/Events', () => ({
	cacheFolloweeReplaceableEvent: vi.fn(),
	followeeEventCache: { getLatest: mocks.getLatest }
}));

import { contactsOfFolloweesReqEmit, followeesOfFollowees } from './MuteAutomatically';

describe('contactsOfFolloweesReqEmit', () => {
	it('does not latch on an empty pre-authentication call and loads established followees', async () => {
		const followee = 'a'.repeat(64);
		const self = 'f'.repeat(64);
		const nestedFollowee = 'b'.repeat(64);
		mocks.getLatest.mockResolvedValue(new Map([[followee, { tags: [['p', nestedFollowee]] }]]));
		mocks.use.mockReturnValue({ pipe: () => ({ subscribe: vi.fn() }) });

		contactsOfFolloweesReqEmit([]);
		expect(mocks.getLatest).not.toHaveBeenCalled();
		expect(mocks.use).not.toHaveBeenCalled();

		const followees = [followee, self];
		contactsOfFolloweesReqEmit(followees);

		expect(mocks.getLatest).toHaveBeenCalledWith(Kind.Contacts, followees);
		expect(mocks.emit).toHaveBeenCalledWith([{ kinds: [Kind.Contacts], authors: followees }]);
		expect(mocks.over).toHaveBeenCalledOnce();
		expect(get(followeesOfFollowees)).toEqual(new Set(followees));
		await Promise.resolve();
		expect(get(followeesOfFollowees)).toEqual(new Set([...followees, nestedFollowee]));

		const updatedFollowees = ['c'.repeat(64), self];
		contactsOfFolloweesReqEmit(updatedFollowees);
		expect(mocks.getLatest).toHaveBeenCalledOnce();
		expect(get(followeesOfFollowees)).toEqual(new Set([...updatedFollowees, nestedFollowee]));
	});
});
