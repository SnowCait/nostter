import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY } from 'rxjs';
import { get } from 'svelte/store';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';
import { Author, type LoadedAccountEvents } from '$lib/Author';
import { db } from '$lib/cache/db';
import { accountAddressableEventCache } from '$lib/cache/Events';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { followingHashtags } from '$lib/Interest';
import { regularMute } from '$lib/features/mute/application/regular-mute-state.svelte';
import { prepareRegularMuteState } from '$lib/features/mute/domain/mute-state';
import { prepareAccountState } from './prepare-account-state';
import { applyAccountInitialization } from './apply-account-initialization';

const accountA = 'a'.repeat(64);
const accountB = 'b'.repeat(64);

function interests(pubkey: string, hashtags: string[]): Nostr.Event {
	return {
		id: `${pubkey}-${hashtags.join('-')}`,
		pubkey,
		kind: Kind.InterestsList,
		created_at: 1,
		tags: hashtags.map((hashtag) => ['t', hashtag]),
		content: '',
		sig: 'sig'
	};
}

function apply(pubkey: string, events: LoadedAccountEvents): void {
	applyAccountInitialization(pubkey, {
		followingPubkeys: [],
		accountState: prepareAccountState(events),
		muteState: {
			mute: prepareRegularMuteState(undefined, pubkey),
			baseline: regularMute.captureInitializationBaseline(),
			mutedPubkeysByKind: new Map()
		}
	});
}

beforeEach(async () => {
	regularMute.reset();
	await accountAddressableEventCache.clear();
	followingHashtags.set([]);
});
afterAll(async () => {
	await db.delete();
});

describe('cached InterestsList account initialization', () => {
	it('applies each account snapshot before relay refresh and clears it on a cache miss', async () => {
		await accountAddressableEventCache.put(interests(accountA, ['nostr', 'bitcoin']));
		await accountAddressableEventCache.put(interests(accountB, ['bitcoin']));

		apply(accountA, await new Author(accountA).fetchEvents());
		expect(get(followingHashtags)).toEqual(['nostr', 'bitcoin']);
		apply(accountB, await new Author(accountB).fetchEvents());
		expect(get(followingHashtags)).toEqual(['bitcoin']);

		await accountAddressableEventCache.remove(accountB, Kind.InterestsList);
		const use = vi.spyOn(rxNostr, 'use').mockReturnValue(EMPTY as never);
		try {
			apply(accountA, await new Author(accountA).fetchEvents());
			apply(accountB, await new Author(accountB).fetchEvents());
			expect(get(followingHashtags)).toEqual([]);
		} finally {
			use.mockRestore();
		}
	});
});
