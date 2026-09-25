import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';
import { defaultRelays } from '$lib/Constants';
import { Preferences, preferencesStore } from '$lib/Preferences';
import { authorProfile, metadataEvent, readRelays, writeRelays } from '$lib/stores/Author';
import { customEmojiListEvent, customEmojiTags } from '$lib/author/CustomEmojis';
import { lastReadAt } from '$lib/author/Notifications';
import { bookmarkEvent, legacyBookmarkEvent } from '$lib/author/Bookmark.svelte';
import { profileBadgesEvent } from '$lib/author/ProfileBadges';
import * as eventCache from '$lib/cache/Events';
import { applyAccountInitialization } from './apply-account-initialization';
import { prepareAccountState } from './prepare-account-state';
import type { PreparedAccountInitialization } from './initialize-account';
import type { User } from '../../../../routes/types';
import { followingHashtags } from '$lib/Interest';
import { kinds as Kind } from 'nostr-tools';
import { regularMute } from '$lib/features/mute/application/regular-mute-state.svelte';
import { prepareRegularMuteState } from '$lib/features/mute/domain/mute-state';

const accountA = 'a'.repeat(64);
const accountB = 'b'.repeat(64);

function event(pubkey: string, created_at: number, kind = 10000): Event {
	return {
		id: `${created_at}`.padStart(64, '0'),
		pubkey,
		created_at,
		kind,
		tags: [],
		content: '',
		sig: 's'.repeat(128)
	} as Event;
}

function emptyPrepared(): PreparedAccountInitialization {
	return {
		followingPubkeys: [],
		accountState: prepareAccountState({
			replaceableEvents: new Map(),
			parameterizedReplaceableEvents: new Map()
		}),
		muteState: {
			mute: prepareRegularMuteState(undefined, accountB),
			baseline: regularMute.captureInitializationBaseline(),
			mutedPubkeysByKind: new Map()
		}
	};
}

beforeEach(() => {
	regularMute.reset();
	authorProfile.set({ name: 'account A' } as User);
	metadataEvent.set(event(accountA, 20, 0));
	readRelays.set(['wss://account-a-read.example']);
	writeRelays.set(['wss://account-a-write.example']);
	preferencesStore.set(Object.assign(new Preferences('{}'), { reactionEmoji: { content: 'A' } }));
	lastReadAt.set(123);
	customEmojiListEvent.set(event(accountA, 21, 10030));
	customEmojiTags.set([['emoji', 'old', 'https://old.example/emoji.png']]);
	bookmarkEvent.set(event(accountA, 22, 10003));
	legacyBookmarkEvent.set(event(accountA, 23, 30003));
	profileBadgesEvent.set(event(accountA, 24, 30008));
	eventCache.authorChannelsEventStore.set(event(accountA, 25, 10005));
	followingHashtags.set(['from-account-a']);
});

describe('applyAccountInitialization snapshot', () => {
	it('replaces account A regular mutes with an explicit empty account B state', () => {
		const preparedA = emptyPrepared();
		const source = { ...event(accountA, 1), tags: [['p', 'muted-by-a']] };
		preparedA.muteState.mute = prepareRegularMuteState(source, accountA);
		applyAccountInitialization(accountA, preparedA);
		expect(regularMute.state.regular.tags.pubkeys).toEqual(['muted-by-a']);

		applyAccountInitialization(accountB, emptyPrepared());
		expect(regularMute.state.accountPubkey).toBe(accountB);
		expect(regularMute.state.regular).toEqual(prepareRegularMuteState(undefined, accountB));
	});

	it('replaces previous account event state with defaults for an empty account', () => {
		applyAccountInitialization(accountB, emptyPrepared());

		expect(get(metadataEvent)).toBeUndefined();
		expect(get(authorProfile)).toEqual({});
		expect(get(readRelays)).toEqual(
			defaultRelays.filter(({ read }) => read).map(({ url }) => url)
		);
		expect(get(writeRelays)).toEqual(
			defaultRelays.filter(({ write }) => write).map(({ url }) => url)
		);
		expect(get(preferencesStore)).toEqual(new Preferences('{}'));
		expect(get(lastReadAt)).toBe(0);
		expect(get(customEmojiListEvent)).toBeUndefined();
		expect(get(customEmojiTags)).toEqual([]);
		expect(get(bookmarkEvent)).toBeUndefined();
		expect(get(legacyBookmarkEvent)).toBeUndefined();
		expect(get(profileBadgesEvent)).toBeUndefined();
		expect(get(eventCache.authorChannelsEventStore)).toBeUndefined();
		expect(get(followingHashtags)).toEqual([]);
	});

	it('applies cached InterestsList hashtags for each account without carrying over the prior account', () => {
		const accountAInterests = {
			...event(accountA, 26, Kind.InterestsList),
			tags: [
				['t', 'nostr'],
				['p', 'ignored'],
				['t', 'bitcoin']
			]
		};
		const accountBInterests = {
			...event(accountB, 27, Kind.InterestsList),
			tags: [['t', 'bitcoin']]
		};
		const preparedA = emptyPrepared();
		preparedA.accountState = prepareAccountState({
			replaceableEvents: new Map([[Kind.InterestsList, accountAInterests]]),
			parameterizedReplaceableEvents: new Map()
		});
		applyAccountInitialization(accountA, preparedA);
		expect(get(followingHashtags)).toEqual(['nostr', 'bitcoin']);

		const preparedB = emptyPrepared();
		preparedB.accountState = prepareAccountState({
			replaceableEvents: new Map([[Kind.InterestsList, accountBInterests]]),
			parameterizedReplaceableEvents: new Map()
		});
		applyAccountInitialization(accountB, preparedB);
		expect(get(followingHashtags)).toEqual(['bitcoin']);

		applyAccountInitialization(accountA, preparedA);
		applyAccountInitialization(accountB, emptyPrepared());
		expect(get(followingHashtags)).toEqual([]);
	});

	it('publishes invalid metadata and replaces the previous account profile with an empty profile', () => {
		const invalidMetadata = { ...event(accountB, 30, 0), content: '{' };
		const prepared = emptyPrepared();
		prepared.accountState = prepareAccountState({
			replaceableEvents: new Map([[0, invalidMetadata]]),
			parameterizedReplaceableEvents: new Map()
		});
		const storeMetadata = vi.spyOn(eventCache, 'storeMetadata').mockImplementation(() => {});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		applyAccountInitialization(accountB, prepared);

		expect(get(metadataEvent)).toBe(invalidMetadata);
		expect(get(authorProfile)).toEqual({});
		expect(warn).toHaveBeenCalledWith(
			'[invalid metadata]',
			expect.any(SyntaxError),
			invalidMetadata
		);
		expect(storeMetadata).toHaveBeenCalledWith(invalidMetadata);
		storeMetadata.mockRestore();
		warn.mockRestore();
	});
});
