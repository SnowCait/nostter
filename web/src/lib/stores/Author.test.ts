import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';
import { muteEvent, muteEventIds, mutePubkeys, muteWords } from './Author';
import { resetKindMute } from '$lib/features/mute/application/kind-mute-runtime.svelte';
import { prepareKindMuteState } from '$lib/features/mute/domain/mute-state';

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
	it('exposes a read-only compatibility projection with defensive Map and Set copies', async () => {
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
		vi.resetModules();
		const runtime = await import('$lib/features/mute/application/kind-mute-runtime.svelte');
		runtime.applyKindMuteInitialization(
			event.pubkey,
			new Map([[6, prepareKindMuteState(event)]])
		);
		const { mutedPubkeysByKindMap, isMuteEvent } = await import('./Author');
		expect('set' in mutedPubkeysByKindMap).toBe(false);
		expect('update' in mutedPubkeysByKindMap).toBe(false);
		expect(get(mutedPubkeysByKindMap).get(6)).toEqual(new Set(['b'.repeat(64)]));
		const projection = get(mutedPubkeysByKindMap);
		projection.get(6)?.add('mutated');
		projection.set(7, new Set(['injected']));
		expect(runtime.getKindMuteState(6)?.pubkeys).toEqual(new Set(['b'.repeat(64)]));
		expect(isMuteEvent({ ...event, kind: 6, pubkey: 'b'.repeat(64) })).toBe(true);
	});
});
