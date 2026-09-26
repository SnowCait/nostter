import { describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { get } from 'svelte/store';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';

const mocks = vi.hoisted(() => ({
	emit: vi.fn(),
	use: vi.fn(),
	cacheAccountEvent: vi.fn()
}));
vi.mock('rx-nostr', async (importOriginal) => ({
	...(await importOriginal<typeof import('rx-nostr')>()),
	createRxForwardReq: () => ({ emit: mocks.emit })
}));
vi.mock('./MainTimeline', () => ({
	rxNostr: { use: mocks.use },
	tie: <T>(source: T): T => source,
	referencesReqEmit: vi.fn(),
	storeSeenOn: vi.fn()
}));
vi.mock('$lib/UserStatus', () => ({ updateUserStatus: vi.fn(), userStatusReqEmit: vi.fn() }));
vi.mock('$lib/author/Action', () => ({
	authorActionReqEmit: vi.fn(),
	updateReactionedEvents: vi.fn(),
	updateRepostedEvents: vi.fn()
}));
vi.mock('$lib/cache/Events', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/cache/Events')>()),
	cacheAccountEvent: mocks.cacheAccountEvent
}));
vi.mock('$lib/auth.svelte', () => ({
	auth: { pubkey: 'a'.repeat(64), followees: ['a'.repeat(64)], signer: undefined }
}));

import { HomeTimeline } from './HomeTimeline';
import { followingHashtags } from '$lib/Interest';
import { regularMute } from '$lib/features/mute/application/regular-mute-state.svelte';
import { prepareRegularMuteState } from '$lib/features/mute/domain/mute-state';

function interests(tags: string[][]): Nostr.Event {
	return {
		id: 'interest-list',
		pubkey: 'a'.repeat(64),
		kind: Kind.InterestsList,
		created_at: 1,
		tags,
		content: '',
		sig: 'sig'
	};
}

describe('HomeTimeline InterestsList refresh', () => {
	it('waits for cache acceptance, then uses live tags in the next subscription filter', async () => {
		const packets = new Subject<{ event: Nostr.Event; from: string }>();
		mocks.use.mockReturnValue(packets);
		mocks.emit.mockClear();
		followingHashtags.set([]);
		const write = Promise.withResolvers<boolean>();
		mocks.cacheAccountEvent.mockReset().mockReturnValue(write.promise);
		const timeline = new HomeTimeline();
		timeline.subscribe();
		expect(mocks.emit).toHaveBeenCalledTimes(1);
		const event = interests([
			['t', 'nostr'],
			['t', 'bitcoin']
		]);
		packets.next({ event, from: 'relay.example' });
		expect(get(followingHashtags)).toEqual([]);
		const updated = Promise.withResolvers<void>();
		mocks.emit.mockImplementationOnce(() => updated.resolve());
		write.resolve(true);
		await updated.promise;
		expect(get(followingHashtags)).toEqual(['nostr', 'bitcoin']);
		const filters = mocks.emit.mock.calls[1]?.[0] as Array<{ '#t'?: string[] }>;
		expect(filters).toContainEqual(expect.objectContaining({ '#t': ['nostr', 'bitcoin'] }));
	});
});

describe('HomeTimeline regular mute ingestion', () => {
	it('updates completed mute state only after the account cache accepts the event', async () => {
		const accountPubkey = 'a'.repeat(64);
		regularMute.reset();
		regularMute.applySnapshot(
			accountPubkey,
			prepareRegularMuteState(undefined, accountPubkey),
			regularMute.captureInitializationBaseline()
		);
		const packets = new Subject<{ event: Nostr.Event; from: string }>();
		mocks.use.mockReturnValue(packets);
		const write = Promise.withResolvers<boolean>();
		mocks.cacheAccountEvent.mockReset().mockReturnValue(write.promise);
		const timeline = new HomeTimeline();
		timeline.subscribe();
		const source = { ...interests([['p', 'muted']]), id: 'mute', kind: Kind.Mutelist };
		const completed = Promise.withResolvers<void>();
		const unsubscribe = regularMute.subscribe(() => {
			if (regularMute.state.regular.event?.id === source.id) completed.resolve();
		});
		packets.next({ event: source, from: 'relay.example' });
		expect(regularMute.state.regular.event).toBeUndefined();
		write.resolve(true);
		await completed.promise;
		unsubscribe();
		expect(regularMute.state.regular.tags.pubkeys).toEqual(['muted']);
	});
});
