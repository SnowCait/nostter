import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type * as Nostr from 'nostr-typedef';

const { getLatest, cacheFolloweeReplaceableEvent, rxNostrUse, req, tie, uniq, latestEach } =
	vi.hoisted(() => {
		let nextSubscriber: {
			next: (packet: { event: Nostr.Event }) => void;
			complete: () => void;
		} | null = null;

		return {
			getLatest: vi.fn().mockResolvedValue(new Map()),
			cacheFolloweeReplaceableEvent: vi.fn(),
			rxNostrUse: vi.fn(() => ({
				pipe: () => ({
					subscribe: (subscriber: {
						next: (packet: { event: Nostr.Event }) => void;
						complete: () => void;
					}) => {
						nextSubscriber = subscriber;
					}
				})
			})),
			req: {
				emit: vi.fn(),
				over: vi.fn(),
				get subscriber() {
					return nextSubscriber;
				}
			},
			tie: (source: unknown) => source,
			uniq: () => (source: unknown) => source,
			latestEach: () => (source: unknown) => source
		};
	});

vi.mock('rx-nostr', () => ({
	createRxBackwardReq: () => req,
	tie,
	uniq,
	latestEach
}));

vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: { use: rxNostrUse },
	tie
}));

vi.mock('$lib/cache/Events', () => ({
	followeeEventCache: { getLatest },
	cacheFolloweeReplaceableEvent
}));

function contactsEvent(pubkey: string, followedPubkeys: string[]): Nostr.Event {
	return {
		id: `id-${pubkey}`,
		kind: 3,
		pubkey,
		created_at: 0,
		content: '',
		sig: '',
		tags: followedPubkeys.map((p) => ['p', p])
	};
}

describe('loadFolloweesOfFollowees', () => {
	beforeEach(() => {
		vi.resetModules();
		getLatest.mockClear().mockResolvedValue(new Map());
		cacheFolloweeReplaceableEvent.mockClear();
		rxNostrUse.mockClear();
		req.emit.mockClear();
		req.over.mockClear();
	});

	it('passes the explicitly given followees to followeeEventCache.getLatest', async () => {
		const { loadFolloweesOfFollowees } = await import('./followees-of-followees');

		loadFolloweesOfFollowees(['alice', 'bob']);

		expect(getLatest).toHaveBeenCalledWith(3, ['alice', 'bob']);
	});

	it('uses the explicitly given followees as the relay REQ authors', async () => {
		const { loadFolloweesOfFollowees } = await import('./followees-of-followees');

		loadFolloweesOfFollowees(['alice', 'bob']);

		expect(req.emit).toHaveBeenCalledWith([{ kinds: [3], authors: ['alice', 'bob'] }]);
	});

	it('uses the explicitly given followees as the initial followeesOfFollowees set', async () => {
		const { loadFolloweesOfFollowees, followeesOfFollowees } =
			await import('./followees-of-followees');

		loadFolloweesOfFollowees(['alice', 'bob']);

		expect(get(followeesOfFollowees)).toEqual(new Set(['alice', 'bob']));
	});

	it('adds pubkeys from contacts event p tags on top of the given followees', async () => {
		const { loadFolloweesOfFollowees, followeesOfFollowees } =
			await import('./followees-of-followees');

		loadFolloweesOfFollowees(['alice']);
		req.subscriber?.next({ event: contactsEvent('alice', ['carol', 'dave']) });
		req.subscriber?.complete();

		expect(get(followeesOfFollowees)).toEqual(new Set(['alice', 'carol', 'dave']));
	});

	it('operates without reading any global authentication state', async () => {
		const source = await import('fs/promises').then((fs) =>
			fs.readFile(new URL('./followees-of-followees.ts', import.meta.url), 'utf-8')
		);

		expect(source).not.toContain('auth.svelte');
	});

	it('does not repeat the relay fetch once already loaded', async () => {
		const { loadFolloweesOfFollowees } = await import('./followees-of-followees');

		loadFolloweesOfFollowees(['alice']);
		expect(req.emit).toHaveBeenCalledTimes(1);
		expect(getLatest).toHaveBeenCalledTimes(1);

		loadFolloweesOfFollowees(['alice', 'bob']);

		expect(req.emit).toHaveBeenCalledTimes(1);
		expect(getLatest).toHaveBeenCalledTimes(1);
	});

	it('uses followees passed after loading as the base set for later followeesOfFollowees updates', async () => {
		const { loadFolloweesOfFollowees, followeesOfFollowees } =
			await import('./followees-of-followees');

		loadFolloweesOfFollowees(['alice']);
		loadFolloweesOfFollowees(['alice', 'bob']); // Already loaded; just updates the base set

		req.subscriber?.next({ event: contactsEvent('alice', ['carol']) });
		req.subscriber?.complete();

		expect(get(followeesOfFollowees)).toEqual(new Set(['alice', 'bob', 'carol']));
	});
});
