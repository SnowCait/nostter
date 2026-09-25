import { describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';

import { prepareRegularMuteStateFromEvent, prepareKindMuteStates } from './prepare-mute-state';
import { prepareMuteTags } from '../domain/mute-state';

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

	it('completes public and private regular mute tags with their source event', async () => {
		const muteEvent = event([
			['p', publicPubkey],
			['p', publicPubkey],
			['p', accountPubkey],
			['e', 'public-event'],
			['e', 'public-event'],
			['word', 'public']
		]);
		const decryptPrivateListContent = vi.fn().mockResolvedValue([
			[
				['p', privatePubkey],
				['p', privatePubkey],
				['e', 'private-event'],
				['e', 'private-event'],
				['word', 'public'],
				['word', 'private']
			],
			false
		]);

		const prepared = await prepareRegularMuteStateFromEvent(
			muteEvent,
			accountPubkey,
			decryptPrivateListContent
		);
		expect(prepared.event).toBe(muteEvent);
		expect(prepared.tags).toEqual({
			pubkeys: [publicPubkey, privatePubkey],
			eventIds: ['public-event', 'private-event'],
			words: ['public', 'private']
		});
		await expect(prepareRegularMuteStateFromEvent(muteEvent, accountPubkey)).resolves.toEqual({
			event: muteEvent,
			tags: { pubkeys: [publicPubkey], eventIds: ['public-event'], words: ['public'] }
		});
	});

	it('represents a missing regular event as a complete empty state', async () => {
		await expect(prepareRegularMuteStateFromEvent(undefined, accountPubkey)).resolves.toEqual({
			event: undefined,
			tags: { pubkeys: [], eventIds: [], words: [] }
		});
	});

	it('retains kind mute source events and public/private pubkeys', async () => {
		const kindEvent = {
			...event([
				['d', '6'],
				['p', publicPubkey]
			]),
			kind: 30007
		};
		const updates = await prepareKindMuteStates(
			[kindEvent],
			vi.fn().mockResolvedValue([[['p', privatePubkey]], false])
		);
		expect(updates.get(6)?.event).toBe(kindEvent);
		expect(updates.get(6)?.pubkeys).toEqual(new Set([publicPubkey, privatePubkey]));
	});

	it('ignores invalid d tags and keeps public kind mute tags on decrypt failure', async () => {
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const kindEvent = {
			...event([
				['d', '6'],
				['p', publicPubkey]
			]),
			kind: 30007
		};
		const updates = await prepareKindMuteStates(
			[
				kindEvent,
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

		expect(updates).toEqual(
			new Map([[6, { event: kindEvent, pubkeys: new Set([publicPubkey]) }]])
		);
		expect(consoleWarn).toHaveBeenCalledOnce();
		consoleWarn.mockRestore();
	});
});
