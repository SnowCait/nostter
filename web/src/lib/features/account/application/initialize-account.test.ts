import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { authorProfile, muteEvent, mutePubkeys } from '$lib/stores/Author';
import { mute as muteState } from '$lib/features/mute/application/mute-state.svelte';
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
	muteState.reset();
	muteState.applySnapshot(
		'a'.repeat(64),
		{
			regular: prepareRegularMuteState(undefined, 'a'.repeat(64), [['p', 'existing-muted']]),
			byKind: new Map()
		},
		muteState.captureInitializationBaseline()
	);
});

describe('prepareAccountInitialization', () => {
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
		expect(prepared.muteState.snapshot.regular.event).toBe(mute);
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

	it('prepares an empty mute snapshot when cached events belong to another account', async () => {
		fetchEvents.mockResolvedValue({
			replaceableEvents: new Map([[10000, { ...mute, pubkey: 'a'.repeat(64) }]]),
			parameterizedReplaceableEvents: new Map([
				['30007:6', { ...mute, pubkey: 'a'.repeat(64), kind: 30007, tags: [['d', '6']] }]
			])
		});
		const { prepareAccountInitialization } = await import('./initialize-account');
		const prepared = await prepareAccountInitialization(me);

		expect(prepared.muteState.snapshot.regular.event).toBeUndefined();
		expect(prepared.muteState.snapshot.regular.tags.pubkeys).toEqual([]);
		expect(prepared.muteState.snapshot.byKind.size).toBe(0);
	});
});
