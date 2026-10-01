import { describe, expect, it } from 'vitest';
import type { Event } from 'nostr-tools';
import { Handlerinformation, LongFormArticle, ShortTextNote } from 'nostr-tools/kinds';
import { createHandlerInformationFilter, parseClientTags, resolveHandlerLink } from './nip89';

const pubkey = 'a'.repeat(64);
const address = `${Handlerinformation}:${pubkey}:handler`;
const pointer = { kind: Handlerinformation, pubkey, identifier: 'handler' };
const target = { kind: ShortTextNote, nevent: 'nevent1example' };

function handler(tags: string[][], content = ''): Event {
	return {
		id: 'b'.repeat(64),
		pubkey,
		kind: Handlerinformation,
		tags: [['d', 'handler'], ['k', String(ShortTextNote)], ...tags],
		content,
		created_at: 1,
		sig: 'c'.repeat(128)
	};
}

describe('parseClientTags', () => {
	it('parses a NIP-89 client tag', () => {
		expect(parseClientTags([['client', 'Foo', address, 'wss://relay.example.com']])).toEqual([
			{ name: 'Foo', handler: { address, pointer, relay: 'wss://relay.example.com' } }
		]);
	});

	it('keeps the client name without a handler when the address is missing or invalid', () => {
		expect(
			parseClientTags([
				['client', 'Name only'],
				['client', 'Not handler', `${LongFormArticle}:${pubkey}:handler`],
				['client', 'Non-canonical kind', `0${Handlerinformation}:${pubkey}:handler`],
				['client', 'Invalid pubkey', `${Handlerinformation}:invalid:handler`],
				['client', 'Invalid address', 'invalid']
			])
		).toEqual([
			{ name: 'Name only' },
			{ name: 'Not handler' },
			{ name: 'Non-canonical kind' },
			{ name: 'Invalid pubkey' },
			{ name: 'Invalid address' }
		]);
	});

	it('accepts only a wss: relay hint', () => {
		expect(
			parseClientTags([
				['client', 'Foo', address, 'ws://relay.example.com'],
				['client', 'Foo', address, 'https://relay.example.com'],
				['client', 'Foo', address, 'invalid']
			]).map(({ handler }) => handler)
		).toEqual([
			{ address, pointer, relay: undefined },
			{ address, pointer, relay: undefined },
			{ address, pointer, relay: undefined }
		]);
	});

	it('ignores non-client tags and client tags without a name', () => {
		expect(
			parseClientTags([['p', pubkey], ['client'], ['client', '', address], ['client', 'Foo']])
		).toEqual([{ name: 'Foo' }]);
	});
});

describe('createHandlerInformationFilter', () => {
	it('creates a filter for the addressed handler supporting the kind', () => {
		expect(createHandlerInformationFilter(pointer, ShortTextNote)).toEqual({
			kinds: [Handlerinformation],
			authors: [pubkey],
			'#d': ['handler'],
			'#k': ['1'],
			limit: 1
		});
	});
});

describe('resolveHandlerLink', () => {
	it('prefers the nevent handler to the generic handler', () => {
		const event = handler([
			['web', 'https://example.com/generic/<bech32>'],
			['web', 'https://example.com/p/<bech32>', 'nprofile'],
			['web', 'https://example.com/e/<bech32>?q=<bech32>', 'nevent']
		]);
		expect(resolveHandlerLink(event, target)?.href).toBe(
			'https://example.com/e/nevent1example?q=nevent1example'
		);
	});

	it('uses the generic handler when there is no nevent handler', () => {
		const event = handler([
			['web', 'https://example.com/p/<bech32>', 'nprofile'],
			['web', 'https://example.com/generic/<bech32>']
		]);
		expect(resolveHandlerLink(event, target)?.href).toBe(
			'https://example.com/generic/nevent1example'
		);
	});

	it('skips a handler URL that is not HTTP(S) or lacks <bech32>', () => {
		const event = handler([
			['web', 'javascript:alert(1)//<bech32>', 'nevent'],
			['web', 'https://example.com/e/', 'nevent'],
			['web', 'nostr:<bech32>'],
			['web', 'https://example.com/generic/<bech32>']
		]);
		expect(resolveHandlerLink(event, target)?.href).toBe(
			'https://example.com/generic/nevent1example'
		);
	});

	it('uses website in the content when there is no web handler', () => {
		const event = handler(
			[
				['web', 'https://example.com/p/<bech32>', 'nprofile'],
				['ios', 'example://<bech32>']
			],
			JSON.stringify({ name: 'Foo', website: 'https://example.com/' })
		);
		expect(resolveHandlerLink(event, target)?.href).toBe('https://example.com/');
	});

	it('rejects an invalid website', () => {
		for (const content of [
			'{"website":"javascript:alert(1)"}',
			'{"website":"example.com"}',
			'{"website":1}',
			'null',
			'invalid'
		]) {
			expect(resolveHandlerLink(handler([], content), target)).toBeUndefined();
		}
	});

	it('returns undefined when there is neither a web handler nor a website', () => {
		expect(resolveHandlerLink(handler([]), target)).toBeUndefined();
		expect(resolveHandlerLink(handler([], '{"name":"Foo"}'), target)).toBeUndefined();
	});

	it('requires a k tag matching the target kind', () => {
		const event = handler([['web', 'https://example.com/<bech32>']]);
		expect(resolveHandlerLink(event, { ...target, kind: LongFormArticle })).toBeUndefined();

		const withoutKind = { ...event, tags: event.tags.filter(([name]) => name !== 'k') };
		expect(resolveHandlerLink(withoutKind, target)).toBeUndefined();
	});
});
