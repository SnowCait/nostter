import { get } from 'svelte/store';
import { of, throwError } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	author: 'a'.repeat(64),
	sent: [] as Nostr.Event[],
	fails: false,
	signEvent: vi.fn(async (event) => ({ ...event, id: 'deletion', sig: 'sig' }))
}));

const author = mocks.author;

vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: {
		send: (event: Nostr.Event) => {
			mocks.sent.push(event);
			return mocks.fails ? throwError(() => new Error('failed')) : of({ ok: true });
		}
	}
}));
vi.mock('$lib/Signer', () => ({ Signer: { signEvent: mocks.signEvent } }));
vi.mock('$lib/stores/Author', async () => {
	const { writable } = await import('svelte/store');
	return { pubkey: writable(mocks.author) };
});

import {
	deleteAddressableEvent,
	deletedEventCoordinates,
	isAddressableEventDeleted,
	storeDeletedEvents
} from './Delete';

const event = (values: Partial<Nostr.Event>): Nostr.Event =>
	({
		id: 'event',
		pubkey: author,
		kind: 5,
		created_at: 10,
		content: '',
		tags: [],
		sig: 'sig',
		...values
	}) as Nostr.Event;

describe('deleteAddressableEvent', () => {
	beforeEach(() => {
		mocks.sent = [];
		mocks.fails = false;
		mocks.signEvent.mockClear();
		deletedEventCoordinates.set(new Map());
	});

	it('publishes only a NIP-09 address deletion request and records relay success', async () => {
		const deletion = await deleteAddressableEvent(30001, author, 'bookmark');

		expect(mocks.signEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: 5,
				tags: [
					['a', `30001:${author}:bookmark`],
					['k', '30001']
				]
			})
		);
		expect(mocks.sent).toHaveLength(1);
		expect(mocks.sent[0].kind).toBe(5);
		expect(get(deletedEventCoordinates).get(`30001:${author}:bookmark`)).toBe(
			deletion.created_at
		);
	});

	it('does not record deletion when no relay accepts the request', async () => {
		mocks.fails = true;
		await expect(deleteAddressableEvent(30001, author, 'bookmark')).rejects.toThrow();
		expect(get(deletedEventCoordinates)).not.toContain(`30001:${author}:bookmark`);
	});

	it('hides only addressable versions at or before the deletion timestamp', () => {
		storeDeletedEvents(event({ created_at: 20, tags: [['a', `30001:${author}:bookmark`]] }));
		const legacy = (created_at: number) =>
			event({ kind: 30001, created_at, tags: [['d', 'bookmark']] });

		expect(isAddressableEventDeleted(legacy(20))).toBe(true);
		expect(isAddressableEventDeleted(legacy(21))).toBe(false);
	});

	it('records received valid deletion requests and keeps the newest timestamp', () => {
		const coordinate = `30001:${author}:bookmark`;
		storeDeletedEvents(event({ created_at: 30, tags: [['a', coordinate]] }));
		storeDeletedEvents(event({ created_at: 20, tags: [['a', coordinate]] }));

		expect(get(deletedEventCoordinates).get(coordinate)).toBe(30);
	});

	it('ignores malformed coordinates and coordinates for another author', () => {
		const otherAuthor = 'b'.repeat(64);
		storeDeletedEvents(
			event({
				tags: [
					['a', 'invalid'],
					['a', `1:${author}:bookmark`],
					['a', `30001:${otherAuthor}:bookmark`]
				]
			})
		);

		expect(get(deletedEventCoordinates)).toEqual(new Map());
	});
});
