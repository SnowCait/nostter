import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { authorProfile, muteEvent, mutePubkeys } from '$lib/stores/Author';
import { regularMute } from '$lib/features/mute/application/regular-mute-state.svelte';
import { prepareRegularMuteState } from '$lib/features/mute/domain/mute-state';
import type { User } from '../../../../routes/types';

const { fetchRelays, fetchEvents, loadMetadata, prune } = vi.hoisted(() => ({
	fetchRelays: vi.fn().mockResolvedValue(undefined),
	fetchEvents: vi.fn(),
	loadMetadata: vi.fn().mockResolvedValue(undefined),
	prune: vi.fn()
}));

vi.mock('$lib/Author', () => ({
	Author: class {
		fetchRelays = fetchRelays;
		fetchEvents = fetchEvents;
	}
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
	regularMute.reset();
	regularMute.applySnapshot(
		me,
		prepareRegularMuteState(undefined, me),
		regularMute.captureInitializationBaseline()
	);
	regularMute.replaceTags(me, [['p', 'existing-muted']]);
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
		expect(get(muteEvent)).toBeUndefined();
		expect(get(mutePubkeys)).toEqual(['existing-muted']);
		expect(loadMetadata).not.toHaveBeenCalled();

		decrypt.resolve([[['p', 'private-muted']], false]);
		await vi.waitFor(() => expect(loadMetadata).toHaveBeenCalledWith([followee, me]));
		expect(get(authorProfile)).toEqual({ name: 'existing' });
		expect(get(muteEvent)).toBeUndefined();
		expect(get(mutePubkeys)).toEqual(['existing-muted']);

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
		expect(get(muteEvent)).toBeUndefined();
		expect(get(mutePubkeys)).toEqual(['existing-muted']);
		expect(loadMetadata).not.toHaveBeenCalled();
	});

	it('captures the mute baseline before decrypt so a later local update survives the snapshot', async () => {
		const entered = Promise.withResolvers<void>();
		const decrypt = Promise.withResolvers<[string[][], boolean]>();
		const preparation = (await import('./initialize-account')).prepareAccountInitialization(
			me,
			() => {
				entered.resolve();
				return decrypt.promise;
			}
		);
		await entered.promise;
		regularMute.replaceTags(me, [['p', 'local']]);
		decrypt.resolve([[['p', 'remote']], false]);
		const prepared = await preparation;
		regularMute.applySnapshot(me, prepared.muteState.mute, prepared.muteState.baseline);
		expect(regularMute.state.regular.tags.pubkeys).toEqual(['local']);
	});
});
