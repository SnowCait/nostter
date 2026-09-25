import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';
import { mute } from '$lib/features/mute/application/mute-state.svelte';
import {
	prepareKindMuteState,
	prepareRegularMuteState
} from '$lib/features/mute/domain/mute-state';
import {
	isMuteEvent,
	muteEvent,
	muteEventIds,
	mutePubkeys,
	muteWords,
	mutedPubkeysByKindMap
} from './Author';

const accountPubkey = 'a'.repeat(64);
const mutedPubkey = 'b'.repeat(64);

function event(kind: number, tags: string[][] = []): Event {
	return {
		id: 'event-id',
		kind,
		pubkey: accountPubkey,
		content: '',
		tags,
		created_at: 1,
		sig: 'sig'
	};
}

beforeEach(() => mute.reset());

describe('mute compatibility projections', () => {
	it('reflects completed state through read-only stores', () => {
		const regularEvent = event(10000, [
			['p', mutedPubkey],
			['e', 'muted-event'],
			['word', 'spoiler']
		]);
		const kindEvent = event(30007, [
			['d', '6'],
			['p', mutedPubkey]
		]);
		mute.applySnapshot(
			accountPubkey,
			{
				regular: prepareRegularMuteState(regularEvent, accountPubkey),
				byKind: new Map([[6, prepareKindMuteState(kindEvent)]])
			},
			mute.captureInitializationBaseline()
		);

		expect(get(muteEvent)).toEqual(regularEvent);
		expect(get(mutePubkeys)).toEqual([mutedPubkey]);
		expect(get(muteEventIds)).toEqual(['muted-event']);
		expect(get(muteWords)).toEqual(['spoiler']);
		expect(get(mutedPubkeysByKindMap).get(6)).toEqual(new Set([mutedPubkey]));
		expect(isMuteEvent({ ...event(6), pubkey: mutedPubkey })).toBe(true);
	});

	it('does not expose writable APIs or share mutable collections with completed state', () => {
		const regularEvent = event(10000, [['p', mutedPubkey]]);
		const kindEvent = event(30007, [
			['d', '6'],
			['p', mutedPubkey]
		]);
		mute.applySnapshot(
			accountPubkey,
			{
				regular: prepareRegularMuteState(regularEvent, accountPubkey),
				byKind: new Map([[6, prepareKindMuteState(kindEvent)]])
			},
			mute.captureInitializationBaseline()
		);

		expect('set' in mutePubkeys).toBe(false);
		get(mutePubkeys).push('other');
		get(mutedPubkeysByKindMap).get(6)?.add('other');
		get(mutedPubkeysByKindMap).set(7, new Set(['other']));
		get(muteEvent)?.tags.push(['p', 'other']);

		expect(mute.state.regular.tags.pubkeys).toEqual([mutedPubkey]);
		expect(mute.state.regular.event?.tags).toEqual([['p', mutedPubkey]]);
		expect(mute.state.byKind.get(6)?.pubkeys).toEqual(new Set([mutedPubkey]));
		expect(mute.state.byKind.has(7)).toBe(false);
	});
});
