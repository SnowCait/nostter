import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';

import {
	muteEvent,
	muteEventIds,
	mutePubkeys,
	muteWords,
	mutedPubkeysByKindMap,
	storeMutedTags,
	storeMutedTagsByEvent,
	storeMutedPubkeysByKind
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
		mutedPubkeysByKindMap.set(new Map());
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

	it('merges public and private tags when a decrypter is provided', async () => {
		const decryptPrivateListContent = vi.fn().mockResolvedValue([
			[
				['p', accountPubkey],
				['p', mutedPubkey],
				['e', 'private-event'],
				['word', 'private-word']
			],
			false
		]);
		const muteListEvent = event([['e', 'public-event']]);

		await storeMutedTagsByEvent(muteListEvent, accountPubkey, decryptPrivateListContent);

		expect(get(muteEvent)).toBe(muteListEvent);
		expect(decryptPrivateListContent).toHaveBeenCalledWith(
			muteListEvent.pubkey,
			muteListEvent.content
		);
		expect(get(mutePubkeys)).toEqual([mutedPubkey]);
		expect(get(muteEventIds)).toEqual(['public-event', 'private-event']);
		expect(get(muteWords)).toEqual(['private-word']);
	});

	it('ignores stale mute events without publishing or decrypting them', async () => {
		const current = { ...event([]), created_at: 2 };
		const stale = { ...event([['p', mutedPubkey]]), created_at: 1 };
		const decryptPrivateListContent = vi.fn();
		muteEvent.set(current);

		await storeMutedTagsByEvent(stale, accountPubkey, decryptPrivateListContent);

		expect(get(muteEvent)).toBe(current);
		expect(decryptPrivateListContent).not.toHaveBeenCalled();
		expect(get(mutePubkeys)).toEqual([]);
	});

	it('publishes the mute event before decrypt and keeps it published on decrypt failure', async () => {
		const muteListEvent = event([]);
		const decryptError = new Error('decrypt failed');
		const decryptPrivateListContent = vi.fn().mockImplementation(async () => {
			expect(get(muteEvent)).toBe(muteListEvent);
			throw decryptError;
		});

		await expect(
			storeMutedTagsByEvent(muteListEvent, accountPubkey, decryptPrivateListContent)
		).rejects.toBe(decryptError);
		expect(get(muteEvent)).toBe(muteListEvent);
		expect(get(mutePubkeys)).toEqual([]);
	});

	it('stores public mute tags without decrypting private content when no decrypter is provided', async () => {
		const muteListEvent = event([
			['p', mutedPubkey],
			['e', 'public-event'],
			['word', 'public-word']
		]);

		await storeMutedTagsByEvent(muteListEvent, accountPubkey);

		expect(get(mutePubkeys)).toEqual([mutedPubkey]);
		expect(get(muteEventIds)).toEqual(['public-event']);
		expect(get(muteWords)).toEqual(['public-word']);
	});

	it('merges public and private tags for kind mute sets only when a decrypter is provided', async () => {
		const kindMuteEvent = {
			...event([
				['d', '6'],
				['p', mutedPubkey]
			]),
			kind: 30007
		};
		const privateMutedPubkey = 'd'.repeat(64);
		const decryptPrivateListContent = vi
			.fn()
			.mockResolvedValue([[['p', privateMutedPubkey]], false]);

		await storeMutedPubkeysByKind([kindMuteEvent], decryptPrivateListContent);

		expect(get(mutedPubkeysByKindMap).get(6)).toEqual(
			new Set([mutedPubkey, privateMutedPubkey])
		);

		mutedPubkeysByKindMap.set(new Map());
		await storeMutedPubkeysByKind([kindMuteEvent]);

		expect(get(mutedPubkeysByKindMap).get(6)).toEqual(new Set([mutedPubkey]));
		expect(decryptPrivateListContent).toHaveBeenCalledTimes(1);
	});
});
