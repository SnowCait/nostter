import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
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
import { regularMute } from '$lib/features/mute/application/regular-mute-state.svelte';
import { prepareRegularMuteState } from '$lib/features/mute/domain/mute-state';

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
	regularMute.reset();
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
	const originalTags = [
		['p', 'public-old'],
		['p', 'private-old']
	];
	const optimisticTags = [...originalTags, ['p', target]];
	const mutedTags = () => regularMute.state.regular.tags.pubkeys.map((pubkey) => ['p', pubkey]);
	beforeEach(() => {
		regularMute.applySnapshot(
			accountA,
			prepareRegularMuteState(cached, accountA, [['p', 'private-old']]),
			regularMute.captureInitializationBaseline()
		);
	});

	it('updates muted tags before relay validation completes', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const publication = mute(muteCapabilities(), 'p', target);
		await validation.entered;
		expect(mutedTags()).toEqual(optimisticTags);
		validation.resolve(cached);
		await publication;
	});

	it('restores cached public and private tags after validation failure', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const publication = mute(muteCapabilities(), 'p', target);
		await validation.entered;
		expect(mutedTags()).toEqual(optimisticTags);
		validation.resolve(event(accountA, 10000, [], 2));
		await expect(publication).rejects.toThrow('Cache is outdated.');
		expect(mutedTags()).toEqual(originalTags);
	});

	it('does not roll back a newer local update after validation failure', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const publication = mute(muteCapabilities(), 'p', target);
		await validation.entered;
		regularMute.replaceTags(accountA, [['p', 'newer-local']]);
		validation.resolve(event(accountA, 10000, [], 2));
		await expect(publication).rejects.toThrow('Cache is outdated.');
		expect(mutedTags()).toEqual([['p', 'newer-local']]);
	});

	it('does not roll back the next account after validation failure', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const publication = mute(muteCapabilities(), 'p', target);
		await validation.entered;
		expect(mutedTags()).toEqual(optimisticTags);
		mocks.activeAccount = accountB;
		regularMute.applySnapshot(
			accountB,
			prepareRegularMuteState(event(accountB, 10000, [['p', 'b-own']]), accountB),
			regularMute.captureInitializationBaseline()
		);
		validation.resolve(event(accountA, 10000, [], 2));
		await expect(publication).rejects.toThrow('Cache is outdated.');
		expect(mutedTags()).toEqual([['p', 'b-own']]);
	});

	it('does not apply an old account update after cache loading', async () => {
		const loaded = Promise.withResolvers<Nostr.Event | undefined>();
		mocks.get.mockReturnValue(loaded.promise);
		const validation = pendingValidation();
		const publication = mute(muteCapabilities(), 'p', target);
		mocks.activeAccount = accountB;
		regularMute.applySnapshot(
			accountB,
			prepareRegularMuteState(event(accountB, 10000, [['p', 'b-own']]), accountB),
			regularMute.captureInitializationBaseline()
		);
		loaded.resolve(cached);
		await validation.entered;
		expect(mutedTags()).toEqual([['p', 'b-own']]);
		validation.resolve(event(accountA, 10000, [], 2));
		await expect(publication).rejects.toThrow('Cache is outdated.');
		expect(mutedTags()).toEqual([['p', 'b-own']]);
	});

	it('rolls back a signer account mismatch without cache or relay writes', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const publication = mute(muteCapabilities(accountB), 'p', target);
		await validation.entered;
		expect(mutedTags()).toEqual(optimisticTags);
		validation.resolve(cached);
		await expect(publication).rejects.toThrow('publication account');
		expect(mutedTags()).toEqual(originalTags);
		expect(mocks.cacheAccountEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it('does not roll back a newer update when signer ownership fails', async () => {
		mocks.get.mockResolvedValue(cached);
		const validation = pendingValidation();
		const signed = Promise.withResolvers<Nostr.Event>();
		const signing = Promise.withResolvers<void>();
		const capabilities = muteCapabilities();
		capabilities.signEvent.mockImplementation(() => {
			signing.resolve();
			return signed.promise;
		});
		const publication = mute(capabilities, 'p', target);
		await validation.entered;
		validation.resolve(cached);
		await signing.promise;
		regularMute.replaceTags(accountA, [['p', 'newer-local']]);
		signed.resolve(event(accountB, 10000, []));
		await expect(publication).rejects.toThrow('publication account');
		expect(mutedTags()).toEqual([['p', 'newer-local']]);
		expect(mocks.cacheAccountEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it('completes the signed event using available private tags without self-decryption', async () => {
		mocks.get.mockResolvedValue(cached);
		mocks.fetchLastEvent.mockResolvedValue(cached);
		const capabilities = muteCapabilities();
		const decrypt = vi.spyOn(capabilities.nip44, 'decrypt');
		await mute(capabilities, 'p', target);
		expect(regularMute.state.regular.event?.id).toBe('signed');
		expect(mutedTags()).toEqual(optimisticTags);
		expect(decrypt).toHaveBeenCalledTimes(1);
	});
});
