import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';
import { defaultRelays } from '$lib/Constants';
import { Preferences, preferencesStore } from '$lib/Preferences';
import {
	authorProfile,
	metadataEvent,
	muteEvent,
	muteEventIds,
	mutePubkeys,
	muteWords,
	mutedPubkeysByKindMap,
	readRelays,
	writeRelays
} from '$lib/stores/Author';
import { customEmojiListEvent, customEmojiTags } from '$lib/author/CustomEmojis';
import { lastReadAt } from '$lib/author/Notifications';
import { bookmarkEvent, legacyBookmarkEvent } from '$lib/author/Bookmark.svelte';
import { profileBadgesEvent } from '$lib/author/ProfileBadges';
import * as eventCache from '$lib/cache/Events';
import { applyAccountInitialization } from './apply-account-initialization';
import { prepareAccountState } from './prepare-account-state';
import type { PreparedAccountInitialization } from './initialize-account';
import type { User } from '../../../../routes/types';

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
			mute: { event: undefined, tags: { pubkeys: [], eventIds: [], words: [] } },
			baselineMuteEvent: get(muteEvent),
			mutedPubkeysByKind: new Map()
		}
	};
}

beforeEach(() => {
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
	muteEvent.set(event(accountA, 200));
	mutePubkeys.set(['old-muted']);
	muteEventIds.set(['old-event']);
	muteWords.set(['old-word']);
	mutedPubkeysByKindMap.set(
		new Map([
			[6, new Set(['old-kind-6'])],
			[7, new Set(['old-kind-7'])]
		])
	);
});

describe('applyAccountInitialization snapshot', () => {
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
		expect(get(muteEvent)).toBeUndefined();
		expect(get(mutePubkeys)).toEqual([]);
		expect(get(muteEventIds)).toEqual([]);
		expect(get(muteWords)).toEqual([]);
		expect(get(mutedPubkeysByKindMap)).toEqual(new Map());
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

	it('replaces muted-by-kind state and allows another account’s newer mute timestamp', () => {
		const targetMuteEvent = event(accountB, 100);
		const prepared = emptyPrepared();
		prepared.muteState = {
			mute: {
				event: targetMuteEvent,
				tags: { pubkeys: ['target-muted'], eventIds: [], words: [] }
			},
			baselineMuteEvent: prepared.muteState.baselineMuteEvent,
			mutedPubkeysByKind: new Map([[6, new Set(['target-kind-6'])]])
		};

		applyAccountInitialization(accountB, prepared);

		expect(get(muteEvent)).toBe(targetMuteEvent);
		expect(get(mutePubkeys)).toEqual(['target-muted']);
		expect(get(mutedPubkeysByKindMap)).toEqual(new Map([[6, new Set(['target-kind-6'])]]));
	});

	it('preserves a target account live mute event that arrives after an empty snapshot was prepared', () => {
		const prepared = emptyPrepared();
		const liveEvent = event(accountB, 50);
		muteEvent.set(liveEvent);
		mutePubkeys.set(['live-muted']);
		muteEventIds.set(['live-event']);
		muteWords.set(['live-word']);

		applyAccountInitialization(accountB, prepared);

		expect(get(muteEvent)).toBe(liveEvent);
		expect(get(mutePubkeys)).toEqual(['live-muted']);
		expect(get(muteEventIds)).toEqual(['live-event']);
		expect(get(muteWords)).toEqual(['live-word']);
	});

	it('keeps a newer live mute event for the same account over an older prepared event', () => {
		const baselineMuteEvent = event(accountB, 100);
		muteEvent.set(baselineMuteEvent);
		mutePubkeys.set(['baseline-muted']);
		const newerLiveEvent = event(accountB, 300);
		const olderPreparedEvent = event(accountB, 200);
		const prepared = emptyPrepared();
		prepared.muteState.mute = {
			event: olderPreparedEvent,
			tags: { pubkeys: ['prepared-muted'], eventIds: [], words: [] }
		};
		muteEvent.set(newerLiveEvent);
		mutePubkeys.set(['newer-live-muted']);

		applyAccountInitialization(accountB, prepared);

		expect(get(muteEvent)).toBe(newerLiveEvent);
		expect(get(mutePubkeys)).toEqual(['newer-live-muted']);
	});
});
