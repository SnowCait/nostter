import { describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { EMPTY } from 'rxjs';

const { use } = vi.hoisted(() => ({ use: vi.fn() }));
vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: { use },
	tie: (source: unknown) => source,
	referencesReqEmit: vi.fn()
}));
import { ChannelChat } from './ChannelChat.svelte';

function channelEvent(kind: number, relays: string[]): Event {
	return {
		id: 'a'.repeat(64),
		pubkey: 'b'.repeat(64),
		created_at: 1,
		kind,
		content: JSON.stringify({ relays }),
		tags: [],
		sig: ''
	};
}

describe('channel relay discovery', () => {
	it('excludes private pointer and metadata relays while retaining default read relays', async () => {
		use.mockReturnValue(EMPTY);
		const chat = new ChannelChat(
			'a'.repeat(64),
			['wss://127.0.0.1/', 'wss://pointer.example/'],
			channelEvent(40, ['wss://[fe80::1]/', 'wss://creation.example/']),
			channelEvent(41, ['wss://relay.local/', 'wss://metadata.example/'])
		);
		await chat.start();
		for (const [, options] of use.mock.calls) {
			expect(options).toEqual({
				on: {
					defaultReadRelays: true,
					relays: [
						'wss://pointer.example/',
						'wss://creation.example/',
						'wss://metadata.example/'
					]
				}
			});
		}
		expect(use).toHaveBeenCalled();
		chat.dispose();
	});
});
