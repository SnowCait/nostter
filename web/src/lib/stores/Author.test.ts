import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';
import { mutedPubkeysByKindMap, storeMutedPubkeysByKind } from './Author';

beforeEach(() => {
	vi.resetAllMocks();
	mutedPubkeysByKindMap.set(new Map());
});

describe('kind mute state', () => {
	it('merges public and private tags only when a decrypter is provided', async () => {
		const event = {
			id: 'event-id',
			kind: 30007,
			pubkey: 'a'.repeat(64),
			content: 'encrypted',
			tags: [
				['d', '6'],
				['p', 'b'.repeat(64)]
			],
			created_at: 1,
			sig: 'sig'
		} as Event;
		const decrypt = vi.fn().mockResolvedValue([[['p', 'd'.repeat(64)]], false]);
		await storeMutedPubkeysByKind([event], decrypt);
		expect(get(mutedPubkeysByKindMap).get(6)).toEqual(
			new Set(['b'.repeat(64), 'd'.repeat(64)])
		);
		mutedPubkeysByKindMap.set(new Map());
		await storeMutedPubkeysByKind([event]);
		expect(get(mutedPubkeysByKindMap).get(6)).toEqual(new Set(['b'.repeat(64)]));
	});
});
