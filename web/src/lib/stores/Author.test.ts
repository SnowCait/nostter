import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isMuteEvent, muteEvent, muteEventIds, mutePubkeys, muteWords } from './Author';
import {
	applyKindMuteInitialization,
	resetKindMute
} from '$lib/features/mute/application/kind-mute-runtime.svelte';
import { prepareKindMuteState } from '$lib/features/mute/domain/mute-state';
import type { Event } from 'nostr-tools';

beforeEach(() => {
	vi.resetAllMocks();
	resetKindMute();
});

describe('regular mute compatibility projections', () => {
	it('exposes read-only Stores', () => {
		for (const store of [muteEvent, mutePubkeys, muteEventIds, muteWords]) {
			expect('set' in store).toBe(false);
			expect('update' in store).toBe(false);
		}
	});
});

describe('kind mute state', () => {
	it('uses kind mute state when checking events', () => {
		const event = {
			id: 'event-id',
			kind: 30007,
			pubkey: 'a'.repeat(64),
			content: '',
			tags: [
				['d', '6'],
				['p', 'b'.repeat(64)]
			],
			created_at: 1,
			sig: 'sig'
		} as Event;
		applyKindMuteInitialization(event.pubkey, new Map([[6, prepareKindMuteState(event)]]));
		expect(isMuteEvent({ ...event, kind: 6, pubkey: 'b'.repeat(64) })).toBe(true);
	});
});
