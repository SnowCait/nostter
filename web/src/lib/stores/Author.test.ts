import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';
import { regularMute } from '$lib/features/mute/application/regular-mute-state.svelte';
import { prepareRegularMuteState } from '$lib/features/mute/domain/mute-state';
import {
	muteEvent,
	muteEventIds,
	mutePubkeys,
	muteWords,
	mutedPubkeysByKindMap,
	storeMutedPubkeysByKind
} from './Author';

const accountPubkey = 'a'.repeat(64);
const mutedPubkey = 'b'.repeat(64);

function event(tags: string[][], kind = 10000): Event {
	return {
		id: 'event-id',
		kind,
		pubkey: accountPubkey,
		content: 'encrypted',
		tags,
		created_at: 1,
		sig: 'sig'
	};
}

beforeEach(() => {
	vi.resetAllMocks();
	regularMute.reset();
	regularMute.applySnapshot(
		accountPubkey,
		prepareRegularMuteState(undefined, accountPubkey),
		regularMute.captureInitializationBaseline()
	);
	mutedPubkeysByKindMap.set(new Map());
});

describe('regular mute compatibility stores', () => {
	it('are read-only and project completed state with defensive copies', () => {
		const source = event([
			['p', mutedPubkey],
			['e', 'muted-event'],
			['word', 'spoiler']
		]);
		regularMute.applySnapshot(
			accountPubkey,
			prepareRegularMuteState(source, accountPubkey),
			regularMute.captureInitializationBaseline()
		);
		expect('set' in muteEvent).toBe(false);
		expect('update' in mutePubkeys).toBe(false);
		expect(get(mutePubkeys)).toEqual([mutedPubkey]);
		expect(get(muteEventIds)).toEqual(['muted-event']);
		expect(get(muteWords)).toEqual(['spoiler']);
		get(mutePubkeys).push('external');
		get(muteEventIds).push('external');
		get(muteWords).push('external');
		get(muteEvent)?.tags[0]?.push('external');
		expect(regularMute.state.regular.tags.pubkeys).toEqual([mutedPubkey]);
		expect(regularMute.state.regular.tags.eventIds).toEqual(['muted-event']);
		expect(regularMute.state.regular.tags.words).toEqual(['spoiler']);
		expect(regularMute.state.regular.event?.tags).toEqual(source.tags);
	});

	it('emits a new complete projection after an update', () => {
		const pubkeys: string[][] = [];
		const unsubscribe = mutePubkeys.subscribe((value) => pubkeys.push(value));
		regularMute.replaceTags(accountPubkey, [['p', mutedPubkey]]);
		unsubscribe();
		expect(pubkeys).toEqual([[], [mutedPubkey]]);
	});
});

describe('kind mute state', () => {
	it('merges public and private tags only when a decrypter is provided', async () => {
		const kindMuteEvent = event(
			[
				['d', '6'],
				['p', mutedPubkey]
			],
			30007
		);
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
