import 'fake-indexeddb/auto';
import { afterAll, beforeEach, expect, it } from 'vitest';
import type { Event } from 'nostr-tools';
import { accountAddressableEventCache } from '$lib/cache/Events';
import { db } from '$lib/cache/db';
import { prepareMuteTags, prepareRegularMuteState } from '../domain/mute-state';
import {
	applyRegularMuteInitialization,
	getCanonicalMuteState,
	getEffectiveMuteTags,
	regularMuteRevision,
	resetRegularMute,
	startOptimisticMute
} from './regular-mute-runtime.svelte';

const owner = 'a'.repeat(64);
const persisted = {
	id: 'persisted',
	pubkey: owner,
	kind: 10000,
	created_at: 1,
	tags: [['p', 'persisted']],
	content: '',
	sig: 'sig'
} as Event;

beforeEach(async () => {
	await accountAddressableEventCache.clear();
	await accountAddressableEventCache.put(persisted);
	resetRegularMute();
	applyRegularMuteInitialization(
		owner,
		prepareRegularMuteState(persisted, owner),
		regularMuteRevision()
	);
});
afterAll(async () => {
	await db.delete();
});

it('keeps optimistic mute only in memory while IndexedDB and canonical retain the signed event', async () => {
	startOptimisticMute(
		owner,
		prepareMuteTags(
			[
				['p', 'persisted'],
				['p', 'optimistic']
			],
			owner
		)
	);
	expect(getEffectiveMuteTags().pubkeys).toEqual(['persisted', 'optimistic']);
	expect(getCanonicalMuteState().tags.pubkeys).toEqual(['persisted']);
	expect(await accountAddressableEventCache.get(owner, 10000)).toEqual(persisted);
});
