import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import type * as Nostr from 'nostr-typedef';

const accountB = 'b'.repeat(64);
const mocks = vi.hoisted(() => ({
	get: vi.fn(async () => undefined),
	cacheAccountEvent: vi.fn(async () => true),
	send: vi.fn(() => of({ ok: true })),
	updateFolloweesStore: vi.fn(),
	storeMutedTags: vi.fn(),
	fetchLastEvent: vi.fn(async () => undefined)
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
vi.mock('$lib/stores/Author', () => ({ storeMutedTags: mocks.storeMutedTags }));
vi.mock('$lib/RxNostrHelper', () => ({ fetchLastEvent: mocks.fetchLastEvent }));
vi.mock('$lib/auth.svelte', () => ({ auth: { pubkey: 'a'.repeat(64) } }));

import { follow } from './Follow';
import { mute } from './Mute';

function signedByB(kind: number): Nostr.Event {
	return {
		id: `wrong-${kind}`,
		pubkey: accountB,
		kind,
		created_at: 1,
		tags: [],
		content: '',
		sig: 'sig'
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('local publication ownership', () => {
	it('rejects a mismatched follow event before follow state, cache, or relay changes', async () => {
		const enteredSigning = Promise.withResolvers<void>();
		const signed = Promise.withResolvers<Nostr.Event>();
		const signEvent = vi.fn(() => {
			enteredSigning.resolve();
			return signed.promise;
		});
		const publication = follow(signEvent, [accountB]);
		await enteredSigning.promise;
		expect(mocks.updateFolloweesStore).not.toHaveBeenCalled();
		signed.resolve(signedByB(3));
		await expect(publication).rejects.toThrow('publication account');
		expect(mocks.updateFolloweesStore).not.toHaveBeenCalled();
		expect(mocks.cacheAccountEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it('rejects a mismatched mute event before mute state, cache, or relay changes', async () => {
		const enteredSigning = Promise.withResolvers<void>();
		const signed = Promise.withResolvers<Nostr.Event>();
		const signEvent = vi.fn(() => {
			enteredSigning.resolve();
			return signed.promise;
		});
		const publication = mute(
			{
				signEvent,
				nip44: { encrypt: async () => 'ciphertext', decrypt: async () => '[]' }
			},
			'p',
			accountB
		);
		await enteredSigning.promise;
		expect(mocks.storeMutedTags).not.toHaveBeenCalled();
		signed.resolve(signedByB(10000));
		await expect(publication).rejects.toThrow('publication account');
		expect(mocks.storeMutedTags).not.toHaveBeenCalled();
		expect(mocks.cacheAccountEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});
});
