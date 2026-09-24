import { describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';

import {
	prepareMuteTags,
	prepareMuteTagsFromEvent,
	prepareMutedPubkeysByKind
} from './prepare-mute-state';

const accountPubkey = 'a'.repeat(64);
const publicPubkey = 'b'.repeat(64);
const privatePubkey = 'c'.repeat(64);

function event(tags: string[][], content = 'encrypted'): Event {
	return {
		id: 'event-id',
		kind: 10000,
		pubkey: 'd'.repeat(64),
		content,
		tags,
		created_at: 1,
		sig: 'sig'
	};
}

describe('mute state preparation', () => {
	it('extracts unique mute values and excludes the explicit account pubkey', () => {
		expect(
			prepareMuteTags(
				[
					['p', accountPubkey],
					['p', publicPubkey],
					['p', publicPubkey],
					['e', 'event-id'],
					['e', 'event-id'],
					['word', 'spoiler'],
					['word', 'spoiler']
				],
				accountPubkey
			)
		).toEqual({ pubkeys: [publicPubkey], eventIds: ['event-id'], words: ['spoiler'] });
	});

	it('prepares public and private mute tags, and uses public tags without a decrypter', async () => {
		const muteEvent = event([
			['p', publicPubkey],
			['word', 'public']
		]);
		const decryptPrivateListContent = vi.fn().mockResolvedValue([
			[
				['p', privatePubkey],
				['word', 'private']
			],
			false
		]);

		await expect(
			prepareMuteTagsFromEvent(muteEvent, accountPubkey, decryptPrivateListContent)
		).resolves.toEqual({
			pubkeys: [publicPubkey, privatePubkey],
			eventIds: [],
			words: ['public', 'private']
		});
		await expect(prepareMuteTagsFromEvent(muteEvent, accountPubkey)).resolves.toEqual({
			pubkeys: [publicPubkey],
			eventIds: [],
			words: ['public']
		});
	});

	it('prepares kind mute updates from event inputs and falls back to public tags on decrypt failure', async () => {
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const updates = await prepareMutedPubkeysByKind(
			[
				{
					...event([
						['d', '6'],
						['p', publicPubkey]
					]),
					kind: 30007
				},
				{
					...event([
						['d', 'invalid'],
						['p', publicPubkey]
					]),
					kind: 30007
				}
			],
			vi.fn().mockRejectedValue(new Error('decrypt failed'))
		);

		expect(updates).toEqual(new Map([[6, new Set([publicPubkey])]]));
		expect(consoleWarn).toHaveBeenCalledOnce();
		consoleWarn.mockRestore();
	});
});
