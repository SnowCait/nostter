import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { Handlerinformation, LongFormArticle, ShortTextNote } from 'nostr-tools/kinds';
import * as nip19 from 'nostr-tools/nip19';
import { get, writable } from 'svelte/store';
import { Subject, lastValueFrom, of, throwError, toArray } from 'rxjs';

const mocks = vi.hoisted(() => ({
	requestEvents: vi.fn(),
	getSeenOnRelays: vi.fn()
}));

vi.mock('$lib/cache/Events', () => ({ replaceableEventsStore: writable(new Map()) }));
vi.mock('$lib/nostr/relay/event-operations', () => ({ requestEvents: mocks.requestEvents }));
vi.mock('$lib/nostr/relay/relay-hints', () => ({ getSeenOnRelays: mocks.getSeenOnRelays }));

import { replaceableEventsStore } from '$lib/cache/Events';
import { resolveClientLinks, type ClientLinks } from './resolve-client-links';

const appPubkey = 'a'.repeat(64);
const fooAddress = `${Handlerinformation}:${appPubkey}:foo`;
const barAddress = `${Handlerinformation}:${appPubkey}:bar`;

function note(tags: string[][]): Event {
	return {
		id: 'b'.repeat(64),
		pubkey: 'c'.repeat(64),
		kind: ShortTextNote,
		tags,
		content: '',
		created_at: 1,
		sig: 'd'.repeat(128)
	};
}

function handler(
	identifier: string,
	tags: string[][],
	{ content = '', created_at = 1, kinds = [ShortTextNote] } = {}
): Event {
	return {
		id: `${identifier}${created_at}`.padEnd(64, '0'),
		pubkey: appPubkey,
		kind: Handlerinformation,
		tags: [['d', identifier], ...kinds.map((kind) => ['k', String(kind)]), ...tags],
		content,
		created_at,
		sig: 'e'.repeat(128)
	};
}

function handlerFilter(identifier: string) {
	return {
		kinds: [Handlerinformation],
		authors: [appPubkey],
		'#d': [identifier],
		'#k': [String(ShortTextNote)],
		limit: 1
	};
}

function hrefs(links: ClientLinks | undefined): Record<string, string> {
	return Object.fromEntries([...(links ?? [])].map(([address, url]) => [address, url.href]));
}

function resolve(event: Event): Promise<ClientLinks[]> {
	return lastValueFrom(resolveClientLinks(event).pipe(toArray()));
}

beforeEach(() => {
	vi.resetAllMocks();
	replaceableEventsStore.set(new Map());
});

describe('resolveClientLinks', () => {
	it('requests deduplicated handlers in a single REQ to secure relay hints and default read relays', async () => {
		mocks.requestEvents.mockReturnValue(of());

		await resolve(
			note([
				['client', 'Foo', fooAddress, 'wss://relay1'],
				['client', 'Bar', barAddress, 'wss://relay2'],
				['client', 'Foo', fooAddress, 'wss://relay1'],
				['client', 'Bar', barAddress, 'ws://insecure']
			])
		);

		expect(mocks.requestEvents).toHaveBeenCalledOnce();
		expect(mocks.requestEvents).toHaveBeenCalledWith(
			[handlerFilter('foo'), handlerFilter('bar')],
			{ relays: ['wss://relay1', 'wss://relay2'], defaultReadRelays: true }
		);
	});

	it('queries default read relays without secure relay hints', async () => {
		mocks.requestEvents.mockReturnValue(of());

		await resolve(note([['client', 'Foo', fooAddress, 'ws://insecure']]));

		expect(mocks.requestEvents).toHaveBeenCalledWith([handlerFilter('foo')], {
			relays: [],
			defaultReadRelays: true
		});
	});

	it('emits a link as soon as a handler arrives without waiting for the REQ to complete', () => {
		const events = new Subject<Event>();
		mocks.requestEvents.mockReturnValue(events);
		const emitted: ClientLinks[] = [];

		const subscription = resolveClientLinks(
			note([
				['client', 'Foo', fooAddress],
				['client', 'Bar', barAddress, 'wss://dead']
			])
		).subscribe((links) => emitted.push(links));
		events.next(handler('foo', [['web', 'https://foo.example/<bech32>']]));

		expect(emitted.map(hrefs)).toEqual([
			{},
			{ [fooAddress]: expect.stringMatching(/^https:\/\/foo\.example\/nevent1/) }
		]);
		subscription.unsubscribe();
		expect(events.observed).toBe(false);
	});

	it('updates the link only when a newer handler replaces the cache', () => {
		const events = new Subject<Event>();
		mocks.requestEvents.mockReturnValue(events);
		const emitted: ClientLinks[] = [];
		resolveClientLinks(note([['client', 'Foo', fooAddress]])).subscribe((links) =>
			emitted.push(links)
		);
		const older = handler('foo', [['web', 'https://old.example/<bech32>']], {
			created_at: 1
		});
		const newer = handler('foo', [['web', 'https://new.example/<bech32>']], {
			created_at: 2
		});

		events.next(older);
		events.next(newer);
		events.next(older);
		events.next(handler('foo', [['web', 'https://new.example/<bech32>']], { created_at: 3 }));

		expect(emitted.map((links) => links.get(fooAddress)?.hostname)).toEqual([
			undefined,
			'old.example',
			'new.example'
		]);
		expect(get(replaceableEventsStore).get(fooAddress)?.created_at).toBe(3);
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
			data: {
				id: event.id,
				author: event.pubkey,
				kind: ShortTextNote,
				relays: ['wss://seen']
			}
		});
	});

	it('does not link a handler without a k tag for the target kind', async () => {
		mocks.requestEvents.mockReturnValue(
			of(
				handler('foo', [['web', 'https://foo.example/<bech32>']], {
					kinds: [LongFormArticle]
				}),
				handler('bar', [['web', 'https://bar.example/<bech32>']], { kinds: [] })
			)
		);

		const links = await resolve(
			note([
				['client', 'Foo', fooAddress],
				['client', 'Bar', barAddress]
			])
		);

		expect(links.map(hrefs)).toEqual([{}]);
	});

	it('does not request kind 0 when the handler has no metadata', async () => {
		mocks.requestEvents.mockReturnValue(of(handler('foo', [])));

		const links = await resolve(note([['client', 'Foo', fooAddress]]));

		expect(mocks.requestEvents).toHaveBeenCalledOnce();
		expect(mocks.requestEvents.mock.calls[0][0]).toEqual([handlerFilter('foo')]);
		expect(links.map(hrefs)).toEqual([{}]);
	});

	it('ignores events that were not requested', async () => {
		mocks.requestEvents.mockReturnValue(
			of(handler('other', [['web', 'https://other.example/<bech32>']]))
		);

		const links = await resolve(note([['client', 'Foo', fooAddress]]));

		expect(links.map(hrefs)).toEqual([{}]);
		expect(get(replaceableEventsStore).size).toBe(0);
	});

	it('uses the cached handler without a REQ', async () => {
		replaceableEventsStore.set(
			new Map([[fooAddress, handler('foo', [['web', 'https://foo.example/<bech32>']])]])
		);

		const links = await resolve(note([['client', 'Foo', fooAddress]]));

		expect(mocks.requestEvents).not.toHaveBeenCalled();
		expect(links.map((links) => links.get(fooAddress)?.hostname)).toEqual(['foo.example']);
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

		expect(mocks.requestEvents).toHaveBeenCalledWith([handlerFilter('bar')], expect.anything());
	});

	it('does not request without valid client handlers', async () => {
		const links = await resolve(
			note([
				['client', 'Foo'],
				['client', 'Bar', `${LongFormArticle}:${appPubkey}:bar`]
			])
		);

		expect(mocks.requestEvents).not.toHaveBeenCalled();
		expect(links).toEqual([]);
	});

	it('keeps the links without an error when the request fails', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		mocks.requestEvents.mockReturnValue(throwError(() => new Error('relay unavailable')));

		const links = await resolve(note([['client', 'Foo', fooAddress]]));

		expect(links.map(hrefs)).toEqual([{}]);
	});
});
