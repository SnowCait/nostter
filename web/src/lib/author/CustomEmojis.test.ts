import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type * as Nostr from 'nostr-typedef';

const { subscriptions } = vi.hoisted(() => ({
	subscriptions: [] as Array<{
		next: (packet: {
			event: {
				id: string;
				pubkey: string;
				created_at: number;
				kind: number;
				tags: string[][];
				content: string;
				sig: string;
			};
		}) => void;
	}>
}));

vi.mock('rx-nostr', () => {
	const identity = () => (source: unknown) => source;
	return {
		createRxBackwardReq: () => ({ emit: vi.fn() }),
		latestEach: identity,
		now: vi.fn(() => 1),
		uniq: identity
	};
});

vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: {
		use: () => ({
			pipe: () => ({
				subscribe: (observer: (typeof subscriptions)[number]) =>
					subscriptions.push(observer)
			})
		})
	},
	tie: (source: unknown) => source
}));

vi.mock('$lib/WebStorage', () => ({ WebStorage: class {} }));
vi.mock('$lib/RxNostrHelper', () => ({ fetchLastEvent: vi.fn() }));

const pubkey = 'a'.repeat(64);

function event(id: string, kind: number, tags: string[][], created_at = 1): Nostr.Event {
	return {
		id,
		kind,
		pubkey,
		tags,
		created_at,
		content: '',
		sig: 's'.repeat(128)
	} as Nostr.Event;
}

function emojiList(id: string, setIdentifier: string, shortcode: string): Nostr.Event {
	return event(id, 10030, [
		['emoji', shortcode, `https://${shortcode}.example/emoji.png`],
		['a', `30030:${pubkey}:${setIdentifier}`]
	]);
}

beforeEach(async () => {
	subscriptions.length = 0;
	const { customEmojiListEvent, customEmojiTags } = await import('./CustomEmojis');
	customEmojiListEvent.set(undefined);
	customEmojiTags.set([]);
});

describe('custom emoji list response lifecycle', () => {
	it('ignores old list responses after a newer list or empty account snapshot is applied', async () => {
		const { applyCustomEmojiListSnapshot, customEmojiListEvent, customEmojiTags } =
			await import('./CustomEmojis');

		const listA = emojiList('list-a', 'set-a', 'base-a');
		applyCustomEmojiListSnapshot(listA);
		const responseA = event('set-event-a', 30030, [
			['emoji', 'from-a', 'https://a.example/e.png']
		]);

		const listB = emojiList('list-b', 'set-b', 'base-b');
		applyCustomEmojiListSnapshot(listB);
		subscriptions[0]?.next({ event: responseA });
		expect(get(customEmojiListEvent)?.id).toBe('list-b');
		expect(get(customEmojiTags)).toEqual([
			['emoji', 'base-b', 'https://base-b.example/emoji.png']
		]);

		const responseB = event('set-event-b', 30030, [
			['emoji', 'from-b', 'https://b.example/e.png']
		]);
		subscriptions[1]?.next({ event: responseB });
		expect(get(customEmojiTags)).toEqual([
			['emoji', 'base-b', 'https://base-b.example/emoji.png'],
			['emoji', 'from-b', 'https://b.example/e.png']
		]);

		const listC = emojiList('list-c', 'set-c', 'base-c');
		applyCustomEmojiListSnapshot(listC);
		applyCustomEmojiListSnapshot(undefined);
		const responseC = event('set-event-c', 30030, [
			['emoji', 'from-c', 'https://c.example/e.png']
		]);
		subscriptions[2]?.next({ event: responseC });
		expect(get(customEmojiListEvent)).toBeUndefined();
		expect(get(customEmojiTags)).toEqual([]);
	});
});
