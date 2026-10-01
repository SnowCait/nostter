import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import * as nip19 from 'nostr-tools/nip19';
import { writable } from 'svelte/store';
import { NEVER, lastValueFrom, of, throwError, toArray } from 'rxjs';

const mocks = vi.hoisted(() => ({
	requestEvents: vi.fn(),
	getSeenOnRelays: vi.fn()
}));

vi.mock('$lib/cache/Events', () => ({ replaceableEventsStore: writable(new Map()) }));
vi.mock('$lib/nostr/relay/event-operations', () => ({ requestEvents: mocks.requestEvents }));
vi.mock('$lib/nostr/relay/relay-hints', () => ({ getSeenOnRelays: mocks.getSeenOnRelays }));

import { replaceableEventsStore } from '$lib/cache/Events';
import { parseClientTags } from '$lib/nostr/protocol/nip89';
import { collectClientHandlers, resolveClientLinks } from './resolve-client-links';

const appPubkey = 'a'.repeat(64);
const fooAddress = `31990:${appPubkey}:foo`;
const barAddress = `31990:${appPubkey}:bar`;

function note(tags: string[][]): Event {
	return {
		id: 'b'.repeat(64),
		pubkey: 'c'.repeat(64),
		kind: 1,
		tags,
		content: '',
		created_at: 1,
		sig: 'd'.repeat(128)
	};
}

function handler(
	identifier: string,
	tags: string[][],
	{ content = '', created_at = 1 } = {}
): Event {
	return {
		id: `${identifier}${created_at}`.padEnd(64, '0'),
		pubkey: appPubkey,
		kind: 31990,
		tags: [['d', identifier], ...tags],
		content,
		created_at,
		sig: 'e'.repeat(128)
	};
}

function resolve(event: Event) {
	return lastValueFrom(resolveClientLinks(event).pipe(toArray()));
}

beforeEach(() => {
	vi.resetAllMocks();
	replaceableEventsStore.set(new Map());
});

describe('collectClientHandlers', () => {
	it('deduplicates handler addresses and relay hints', () => {
		const { handlers, relays } = collectClientHandlers(
			parseClientTags([
				['client', 'Foo', fooAddress, 'wss://relay1'],
				['client', 'Foo', fooAddress, 'wss://relay2'],
				['client', 'Bar', barAddress, 'wss://relay1'],
				['client', 'Baz']
			])
		);
		expect(handlers.map(({ address }) => address)).toEqual([fooAddress, barAddress]);
		expect(relays).toEqual(['wss://relay1', 'wss://relay2']);
	});
});

describe('resolveClientLinks', () => {
	it('requests all handlers in a single REQ to relay hints and default read relays', async () => {
		mocks.requestEvents.mockReturnValue(
			of(
				handler('foo', [], {
					content: JSON.stringify({ website: 'https://foo.example/' })
				}),
				handler('bar', [])
			)
		);

		const links = await resolve(
			note([
				['client', 'Foo', fooAddress, 'wss://relay1'],
				['client', 'Bar', barAddress, 'wss://relay2'],
				['client', 'Foo', fooAddress, 'wss://relay1']
			])
		);

		expect(mocks.requestEvents).toHaveBeenCalledOnce();
		expect(mocks.requestEvents).toHaveBeenCalledWith(
			[
				{ kinds: [31990], authors: [appPubkey], '#d': ['foo'], limit: 1 },
				{ kinds: [31990], authors: [appPubkey], '#d': ['bar'], limit: 1 }
			],
			{ relays: ['wss://relay1', 'wss://relay2'], defaultReadRelays: true }
		);
		expect(links.at(-1)).toEqual(new Map([[fooAddress, new URL('https://foo.example/')]]));
	});

	it('queries default read relays without relay hints', async () => {
		mocks.requestEvents.mockReturnValue(of());

		await resolve(note([['client', 'Foo', fooAddress]]));

		expect(mocks.requestEvents).toHaveBeenCalledWith(expect.any(Array), {
			relays: [],
			defaultReadRelays: true
		});
	});

	it('does not request kind 0 when the handler has no metadata', async () => {
		mocks.requestEvents.mockReturnValue(of(handler('foo', [])));

		const links = await resolve(note([['client', 'Foo', fooAddress]]));

		expect(mocks.requestEvents).toHaveBeenCalledOnce();
		expect(mocks.requestEvents.mock.calls[0][0]).toEqual([
			expect.objectContaining({ kinds: [31990] })
		]);
		expect(links.at(-1)).toEqual(new Map());
	});

	it('links the nevent of the target event with known relay hints', async () => {
		mocks.getSeenOnRelays.mockReturnValue(['wss://seen']);
		mocks.requestEvents.mockReturnValue(
			of(handler('foo', [['web', 'https://foo.example/<bech32>', 'nevent']]))
		);
		const event = note([['client', 'Foo', fooAddress]]);

		const links = await resolve(event);

		const nevent = links.at(-1)?.get(fooAddress)?.pathname.slice(1) ?? '';
		expect(nip19.decode(nevent)).toEqual({
			type: 'nevent',
			data: { id: event.id, author: event.pubkey, kind: 1, relays: ['wss://seen'] }
		});
	});

	it('keeps the latest version of the handler in the cache', async () => {
		const older = handler('foo', [['web', 'https://old.example/<bech32>']], {
			created_at: 1
		});
		const latest = handler('foo', [['web', 'https://new.example/<bech32>']], {
			created_at: 2
		});
		mocks.requestEvents.mockReturnValue(of(latest, older));

		const links = await resolve(note([['client', 'Foo', fooAddress]]));

		expect(links.at(-1)?.get(fooAddress)?.hostname).toBe('new.example');
		replaceableEventsStore.subscribe((events) => {
			expect(events.get(fooAddress)).toBe(latest);
		})();
	});

	it('ignores events that were not requested', async () => {
		mocks.requestEvents.mockReturnValue(
			of(handler('other', [['web', 'https://other.example/<bech32>']]))
		);

		const links = await resolve(note([['client', 'Foo', fooAddress]]));

		expect(links.at(-1)).toEqual(new Map());
		replaceableEventsStore.subscribe((events) => {
			expect(events.size).toBe(0);
		})();
	});

	it('uses the cached handler without a REQ', async () => {
		replaceableEventsStore.set(
			new Map([[fooAddress, handler('foo', [['web', 'https://foo.example/<bech32>']])]])
		);
		mocks.requestEvents.mockReturnValue(NEVER);

		const links = await resolve(note([['client', 'Foo', fooAddress]]));

		expect(mocks.requestEvents).not.toHaveBeenCalled();
		expect(links).toHaveLength(1);
		expect(links[0].get(fooAddress)?.hostname).toBe('foo.example');
	});

	it('requests only handlers that are not cached', async () => {
		replaceableEventsStore.set(new Map([[fooAddress, handler('foo', [])]]));
		mocks.requestEvents.mockReturnValue(of());

		await resolve(
			note([
				['client', 'Foo', fooAddress],
				['client', 'Bar', barAddress]
			])
		);

		expect(mocks.requestEvents).toHaveBeenCalledWith(
			[{ kinds: [31990], authors: [appPubkey], '#d': ['bar'], limit: 1 }],
			expect.anything()
		);
	});

	it('does not request without valid client handlers', async () => {
		const links = await resolve(
			note([
				['client', 'Foo'],
				['client', 'Bar', `30023:${appPubkey}:bar`]
			])
		);

		expect(mocks.requestEvents).not.toHaveBeenCalled();
		expect(links).toEqual([]);
	});

	it('falls back to no links when the request fails', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		mocks.requestEvents.mockReturnValue(throwError(() => new Error('relay unavailable')));

		const links = await resolve(note([['client', 'Foo', fooAddress]]));

		expect(links.at(-1)).toEqual(new Map());
	});
});
