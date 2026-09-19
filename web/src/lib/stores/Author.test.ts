import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';

const mocks = vi.hoisted(() => ({ decryptListContent: vi.fn() }));

vi.mock('$lib/List', () => ({ decryptListContent: mocks.decryptListContent }));

import {
	muteEvent,
	muteEventIds,
	mutePubkeys,
	muteWords,
	storeMutedTags,
	storeMutedTagsByEvent
} from './Author';

const accountPubkey = 'a'.repeat(64);
const mutedPubkey = 'b'.repeat(64);

function event(tags: string[][]): Event {
	return {
		id: 'event-id',
		kind: 10000,
		pubkey: 'c'.repeat(64),
		content: 'encrypted',
		tags,
		created_at: 1,
		sig: 'sig'
	};
}

describe('mute list state', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		muteEvent.set(undefined);
		mutePubkeys.set([]);
		muteEventIds.set([]);
		muteWords.set([]);
	});

	it('excludes the explicit account pubkey while retaining other mute tags', async () => {
		await storeMutedTags(
			[
				['p', accountPubkey],
				['p', mutedPubkey],
				['p', mutedPubkey],
				['e', 'muted-event'],
				['word', 'spoiler']
			],
			accountPubkey
		);

		expect(get(mutePubkeys)).toEqual([mutedPubkey]);
		expect(get(muteEventIds)).toEqual(['muted-event']);
		expect(get(muteWords)).toEqual(['spoiler']);
	});

	it('uses the explicit account pubkey when storing mute tags from an event', async () => {
		mocks.decryptListContent.mockResolvedValue([
			[
				['p', accountPubkey],
				['p', mutedPubkey],
				['e', 'private-event'],
				['word', 'private-word']
			],
			false
		]);
		const muteListEvent = event([['e', 'public-event']]);

		await storeMutedTagsByEvent(muteListEvent, accountPubkey);

		expect(get(muteEvent)).toBe(muteListEvent);
		expect(get(mutePubkeys)).toEqual([mutedPubkey]);
		expect(get(muteEventIds)).toEqual(['public-event', 'private-event']);
		expect(get(muteWords)).toEqual(['private-word']);
	});
});
