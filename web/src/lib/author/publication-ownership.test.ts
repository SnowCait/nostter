import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import {
	applyRegularMuteInitialization,
	getCanonicalMuteState,
	ingestRemoteMute,
	getCanonicalMuteEvent,
	getEffectiveMuteTags,
	regularMuteRevision,
	resetRegularMute
} from '$lib/features/mute/application/regular-mute-runtime.svelte';
import { prepareRegularMuteState } from '$lib/features/mute/domain/mute-state';
import type * as Nostr from 'nostr-typedef';

const accountA = 'a'.repeat(64);
const accountB = 'b'.repeat(64);
const target = 'c'.repeat(64);
const mocks = vi.hoisted(() => ({
	activeAccount: 'a'.repeat(64),
	following: [] as string[],
	get: vi.fn<(_pubkey: string, _kind: number) => Promise<Nostr.Event | undefined>>(
		async () => undefined
	),
	cacheAccountEvent: vi.fn(async () => true),
	send: vi.fn(() => of({ ok: true })),
	updateFolloweesStore: vi.fn((tags: string[][]) => {
		mocks.following = tags.filter(([name]) => name === 'p').map(([, pubkey]) => pubkey);
	}),
	fetchLastEvent: vi.fn<(_filter: unknown) => Promise<Nostr.Event | undefined>>(
		async () => undefined
	)
}));
vi.mock('$lib/cache/Events', () => ({
	accountAddressableEventCache: { get: mocks.get },
	cacheAccountEvent: mocks.cacheAccountEvent,
	metadataStore: {}
}));
vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: { send: mocks.send },
	metadataReqEmit: vi.fn(),
	tie: <T>(source: T): T => source
}));
vi.mock('$lib/timelines/HomeTimeline', () => ({ timeline: { subscribe: vi.fn() } }));
vi.mock('$lib/Contacts', () => ({ updateFolloweesStore: mocks.updateFolloweesStore }));
vi.mock('$lib/RxNostrHelper', () => ({ fetchLastEvent: mocks.fetchLastEvent }));
vi.mock('$lib/auth.svelte', () => ({
	auth: {
		get pubkey() {
			return mocks.activeAccount;
		}
	}
}));

import { follow } from './Follow';
import { mute } from './Mute';

function event(pubkey: string, kind: number, tags: string[][], createdAt = 1): Nostr.Event {
	return {
		id: `event-${createdAt}`,
		pubkey,
		kind,
		created_at: createdAt,
		tags,
		content: kind === 10000 ? 'ciphertext' : '',
		sig: 'sig'
	};
}

function pendingValidation() {
	const entered = Promise.withResolvers<void>();
	const result = Promise.withResolvers<Nostr.Event | undefined>();
	mocks.fetchLastEvent.mockImplementation(() => {
		entered.resolve();
		return result.promise;
	});
	return { entered: entered.promise, resolve: result.resolve };
}

function signEvent(pubkey = accountA) {
	return vi.fn(async (unsigned: Nostr.UnsignedEvent): Promise<Nostr.Event> => ({
		...unsigned,
		id: 'signed',
		pubkey,
		sig: 'sig'
	}));
}

function muteCapabilities(pubkey = accountA) {
	return {
		signEvent: signEvent(pubkey),
		nip44: {
			encrypt: async () => 'ciphertext',
			decrypt: async () => JSON.stringify([['p', 'private-old']])
		}
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.activeAccount = accountA;
	mocks.following = [];
	mocks.get.mockResolvedValue(undefined);
	mocks.fetchLastEvent.mockResolvedValue(undefined);
});

describe('follow publication', () => {
	const cached = event(accountA, 3, [['p', 'old']]);

	it('updates following before relay validation completes', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const publication = follow(signEvent(), [target]);
		await validation.entered;
		expect(mocks.following).toEqual(['old', target]);
		validation.resolve(cached);
		await publication;
	});

	it('rolls back to cached following after validation failure', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const publication = follow(signEvent(), [target]);
		await validation.entered;
		expect(mocks.following).toEqual(['old', target]);
		validation.resolve(event(accountA, 3, [], 2));
		await expect(publication).rejects.toThrow('Cache is outdated.');
		expect(mocks.following).toEqual(['old']);
		expect(cached.tags).toEqual([['p', 'old']]);
	});

	it('does not roll back the next account after validation failure', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const publication = follow(signEvent(), [target]);
		await validation.entered;
		expect(mocks.following).toEqual(['old', target]);
		mocks.activeAccount = accountB;
		mocks.following = ['b-own'];
		validation.resolve(event(accountA, 3, [], 2));
		await expect(publication).rejects.toThrow('Cache is outdated.');
		expect(mocks.following).toEqual(['b-own']);
	});

	it('does not apply an old account update after cache loading', async () => {
		const loaded = Promise.withResolvers<Nostr.Event | undefined>();
		mocks.get.mockReturnValue(loaded.promise);
		const validation = pendingValidation();
		const publication = follow(signEvent(), [target]);
		mocks.activeAccount = accountB;
		mocks.following = ['b-own'];
		loaded.resolve(cached);
		await validation.entered;
		expect(mocks.following).toEqual(['b-own']);
		validation.resolve(event(accountA, 3, [], 2));
		await expect(publication).rejects.toThrow('Cache is outdated.');
		expect(mocks.following).toEqual(['b-own']);
	});

	it('rolls back a signer account mismatch without cache or relay writes', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const publication = follow(signEvent(accountB), [target]);
		await validation.entered;
		expect(mocks.following).toEqual(['old', target]);
		validation.resolve(cached);
		await expect(publication).rejects.toThrow('publication account');
		expect(mocks.following).toEqual(['old']);
		expect(mocks.cacheAccountEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});
});

describe('mute publication', () => {
	const cached = event(accountA, 10000, [['p', 'public-old']]);
	const oldState = prepareRegularMuteState(cached, accountA, [['p', 'private-old']]);
	beforeEach(() => {
		resetRegularMute();
		applyRegularMuteInitialization(accountA, oldState, regularMuteRevision());
		mocks.fetchLastEvent.mockResolvedValue(cached);
	});

	it('shows optimistic tags before validation without changing canonical or cache', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const publication = mute(muteCapabilities(), 'p', target);
		await validation.entered;
		expect(getEffectiveMuteTags().pubkeys).toEqual(['public-old', 'private-old', target]);
		expect(getCanonicalMuteState()).toEqual(oldState);
		expect(mocks.cacheAccountEvent).not.toHaveBeenCalled();
		validation.resolve(cached);
		await publication;
	});

	it('clears optimistic tags after validation failure and retains remote canonical', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const publication = mute(muteCapabilities(), 'p', target);
		await validation.entered;
		const remote = event(accountA, 10000, [['p', 'remote']], 2);
		await ingestRemoteMute(accountA, remote, async () => [[], false]);
		expect(getEffectiveMuteTags().pubkeys).toEqual(['public-old', 'private-old', target]);
		validation.resolve(remote);
		await expect(publication).rejects.toThrow('Cache is outdated.');
		expect(getEffectiveMuteTags().pubkeys).toEqual(['remote']);
		expect(getCanonicalMuteEvent()?.id).toBe(remote.id);
		expect(mocks.cacheAccountEvent).not.toHaveBeenCalled();
	});

	it('does not change the next account after validation fails', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const publication = mute(muteCapabilities(), 'p', target);
		await validation.entered;
		mocks.activeAccount = accountB;
		applyRegularMuteInitialization(
			accountB,
			prepareRegularMuteState(undefined, accountB),
			regularMuteRevision()
		);
		validation.resolve(event(accountA, 10000, [], 2));
		await expect(publication).rejects.toThrow('Cache is outdated.');
		expect(getEffectiveMuteTags().pubkeys).toEqual([]);
	});

	it('does not apply an old account update after cache loading', async () => {
		const loaded = Promise.withResolvers<Nostr.Event | undefined>();
		mocks.get.mockReturnValue(loaded.promise);
		const validation = pendingValidation();
		const publication = mute(muteCapabilities(), 'p', target);
		mocks.activeAccount = accountB;
		applyRegularMuteInitialization(
			accountB,
			prepareRegularMuteState(undefined, accountB),
			regularMuteRevision()
		);
		loaded.resolve(cached);
		await validation.entered;
		expect(getEffectiveMuteTags().pubkeys).toEqual([]);
		validation.resolve(event(accountA, 10000, [], 2));
		await expect(publication).rejects.toThrow('Cache is outdated.');
	});

	it('clears optimistic tags on signer mismatch without cache or relay writes', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const publication = mute(muteCapabilities(accountB), 'p', target);
		await validation.entered;
		validation.resolve(cached);
		await expect(publication).rejects.toThrow('publication account');
		expect(getEffectiveMuteTags().pubkeys).toEqual(['public-old', 'private-old']);
		expect(mocks.cacheAccountEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it('completes an accepted signed event from local private tags', async () => {
		mocks.get.mockResolvedValue(cached);
		await mute(muteCapabilities(), 'p', target);
		expect(mocks.cacheAccountEvent).toHaveBeenCalledOnce();
		expect(getCanonicalMuteEvent()?.id).toBe('signed');
		expect(getEffectiveMuteTags().pubkeys).toEqual(['public-old', 'private-old', target]);
		expect(getCanonicalMuteState().tags.pubkeys).toEqual(['public-old', 'private-old', target]);
	});

	it('does not complete a cache rejected signed event over a newer current event', async () => {
		const newer = event(accountA, 10000, [['p', 'newer']], 9999999999);
		mocks.get.mockResolvedValueOnce(cached).mockResolvedValueOnce(newer);
		mocks.cacheAccountEvent.mockResolvedValueOnce(false);
		await mute(muteCapabilities(), 'p', target);
		expect(getCanonicalMuteEvent()?.id).toBe(cached.id);
		expect(getEffectiveMuteTags().pubkeys).toEqual(['public-old', 'private-old']);
	});

	it('completes a cache rejected signed event when it is already current', async () => {
		mocks.get.mockResolvedValueOnce(cached).mockResolvedValueOnce({ ...cached, id: 'signed' });
		mocks.cacheAccountEvent.mockResolvedValueOnce(false);
		await mute(muteCapabilities(), 'p', target);
		expect(getCanonicalMuteEvent()?.id).toBe('signed');
		expect(getEffectiveMuteTags().pubkeys).toEqual(['public-old', 'private-old', target]);
	});

	it('preserves a pending remote candidate after a cache rejection', async () => {
		const remote = event(accountA, 10000, [['p', 'remote']], 9999999999);
		const decrypt = Promise.withResolvers<[string[][], boolean]>();
		const completion = ingestRemoteMute(accountA, remote, () => decrypt.promise);
		mocks.get.mockResolvedValueOnce(cached).mockResolvedValueOnce(remote);
		mocks.cacheAccountEvent.mockResolvedValueOnce(false);
		await mute(muteCapabilities(), 'p', target);
		expect(getEffectiveMuteTags().pubkeys).toEqual(['public-old', 'private-old']);
		decrypt.resolve([[], false]);
		await completion;
		expect(getEffectiveMuteTags().pubkeys).toEqual(['remote']);
	});
});
