import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { authorProfile } from '$lib/stores/Author';
import {
	getCanonicalMuteEvent,
	getEffectiveMuteTags,
	resetRegularMute
} from '$lib/features/mute/application/regular-mute-runtime.svelte';
import type { User } from '../../../../routes/types';

const { fetchRelays, fetchEvents, fetchDeletionRequests, loadMetadata, prune } = vi.hoisted(() => ({
	fetchRelays: vi.fn().mockResolvedValue(undefined),
	fetchEvents: vi.fn(),
	fetchDeletionRequests: vi.fn().mockResolvedValue([]),
	loadMetadata: vi.fn().mockResolvedValue(undefined),
	prune: vi.fn()
}));

vi.mock('$lib/Author', () => ({
	Author: class {
		fetchRelays = fetchRelays;
		fetchEvents = fetchEvents;
	}
}));

vi.mock('$lib/features/event-deletion/application/fetch-address-deletion-requests', () => ({
	fetchAddressDeletionRequests: fetchDeletionRequests
}));

vi.mock('$lib/cache/Events', () => ({
	loadFolloweesMetadataCache: loadMetadata,
	pruneFolloweeReplaceableEventsCache: prune
}));

const me = 'f'.repeat(64);
const followee = 'a'.repeat(64);
const mute = {
	id: 'mute-event',
	pubkey: me,
	created_at: 10,
	kind: 10000,
	tags: [['p', 'public-muted']],
	content: 'private-list',
	sig: 'sig'
};

beforeEach(() => {
	vi.clearAllMocks();
	resetRegularMute();
	fetchRelays.mockResolvedValue(undefined);
	loadMetadata.mockResolvedValue(undefined);
	fetchEvents.mockResolvedValue({
		replaceableEvents: new Map([
			[3, { ...mute, id: 'contacts', kind: 3, tags: [['p', followee]], content: '' }],
			[10000, mute]
		]),
		parameterizedReplaceableEvents: new Map()
	});
	authorProfile.set({ name: 'existing' } as User);
});

describe('prepareAccountInitialization', () => {
	it('includes cached InterestsList tags in the prepared account snapshot', async () => {
		fetchEvents.mockResolvedValue({
			replaceableEvents: new Map([
				[3, { ...mute, id: 'contacts', kind: 3, tags: [], content: '' }],
				[
					10015,
					{
						...mute,
						id: 'interests',
						kind: 10015,
						tags: [
							['t', 'nostr'],
							['t', 'bitcoin']
						],
						content: ''
					}
				]
			]),
			parameterizedReplaceableEvents: new Map()
		});
		const { prepareAccountInitialization } = await import('./initialize-account');
		const prepared = await prepareAccountInitialization(me);
		expect(prepared.accountState.followingHashtags).toEqual(['nostr', 'bitcoin']);
	});

	it('waits for mute decryption and required metadata loading without publishing account state', async () => {
		const decrypt = Promise.withResolvers<[string[][], boolean]>();
		const decrypter = vi.fn(() => decrypt.promise);
		const { prepareAccountInitialization } = await import('./initialize-account');
		const preparation = prepareAccountInitialization(me, decrypter);

		await vi.waitFor(() => expect(decrypter).toHaveBeenCalledOnce());
		expect(get(authorProfile)).toEqual({ name: 'existing' });
		expect(getCanonicalMuteEvent()).toBeUndefined();
		expect(getEffectiveMuteTags().pubkeys).toEqual([]);
		expect(loadMetadata).not.toHaveBeenCalled();

		decrypt.resolve([[['p', 'private-muted']], false]);
		await vi.waitFor(() => expect(loadMetadata).toHaveBeenCalledWith([followee, me]));
		expect(get(authorProfile)).toEqual({ name: 'existing' });
		expect(getCanonicalMuteEvent()).toBeUndefined();
		expect(getEffectiveMuteTags().pubkeys).toEqual([]);

		const prepared = await preparation;
		expect(prepared.followingPubkeys).toEqual([followee]);
		expect(prepared.muteState.mute).toMatchObject({ event: mute });
		expect(prune).toHaveBeenCalledWith([followee, me]);
	});

	it('propagates regular mute decryption failure before required cache loading', async () => {
		const { prepareAccountInitialization } = await import('./initialize-account');
		const failure = new Error('cannot decrypt mute list');

		await expect(
			prepareAccountInitialization(me, vi.fn().mockRejectedValue(failure))
		).rejects.toBe(failure);

		expect(get(authorProfile)).toEqual({ name: 'existing' });
		expect(getCanonicalMuteEvent()).toBeUndefined();
		expect(getEffectiveMuteTags().pubkeys).toEqual([]);
		expect(loadMetadata).not.toHaveBeenCalled();
	});
});
