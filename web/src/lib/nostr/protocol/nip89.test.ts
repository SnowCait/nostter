import { describe, expect, it } from 'vitest';
import type { Event } from 'nostr-tools';
import {
	applyHandlerUrlTemplate,
	createHandlerInformationFilter,
	parseClientTags,
	parseHandlerWebsite,
	resolveHandlerLink
} from './nip89';

const pubkey = 'a'.repeat(64);
const address = `31990:${pubkey}:handler`;
const nevent = 'nevent1example';

function handler(tags: string[][], content = ''): Event {
	return {
		id: 'b'.repeat(64),
		pubkey,
		kind: 31990,
		tags: [['d', 'handler'], ...tags],
		content,
		created_at: 1,
		sig: 'c'.repeat(128)
	};
}

describe('parseClientTags', () => {
	it('parses a NIP-89 client tag', () => {
		expect(parseClientTags([['client', 'Foo', address, 'wss://relay.example.com']])).toEqual([
			{
				name: 'Foo',
				handler: {
					address,
					pointer: { kind: 31990, pubkey, identifier: 'handler' },
					relay: 'wss://relay.example.com'
				}
			}
		]);
	});

	it('keeps the client name without a handler when the address is missing or invalid', () => {
		expect(
			parseClientTags([
				['client', 'Name only'],
				['client', 'Not handler', `30023:${pubkey}:handler`],
				['client', 'Non-canonical kind', `031990:${pubkey}:handler`],
				['client', 'Invalid pubkey', '31990:invalid:handler'],
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

	it('ignores an invalid relay hint', () => {
		expect(parseClientTags([['client', 'Foo', address, 'https://relay.example.com']])).toEqual([
			{
				name: 'Foo',
				handler: {
					address,
					pointer: { kind: 31990, pubkey, identifier: 'handler' },
					relay: undefined
				}
			}
		]);
	});

	it('ignores non-client tags and client tags without a name', () => {
		expect(
			parseClientTags([['p', pubkey], ['client'], ['client', '', address], ['client', 'Foo']])
		).toEqual([{ name: 'Foo' }]);
	});
});

describe('createHandlerInformationFilter', () => {
	it('creates a filter for the addressed kind 31990', () => {
		expect(
			createHandlerInformationFilter({ kind: 31990, pubkey, identifier: 'handler' })
		).toEqual({ kinds: [31990], authors: [pubkey], '#d': ['handler'], limit: 1 });
	});
});

describe('resolveHandlerLink', () => {
	it('prefers the nevent handler to the generic handler', () => {
		const event = handler([
			['web', 'https://example.com/generic/<bech32>'],
			['web', 'https://example.com/p/<bech32>', 'nprofile'],
			['web', 'https://example.com/e/<bech32>', 'nevent']
		]);
		expect(resolveHandlerLink(event, nevent)?.href).toBe(`https://example.com/e/${nevent}`);
	});

	it('uses the generic handler when there is no nevent handler', () => {
		const event = handler([
			['web', 'https://example.com/p/<bech32>', 'nprofile'],
			['web', 'https://example.com/generic/<bech32>']
		]);
		expect(resolveHandlerLink(event, nevent)?.href).toBe(
			`https://example.com/generic/${nevent}`
		);
	});

	it('skips an invalid nevent handler', () => {
		const event = handler([
			['web', 'javascript:alert(1)//<bech32>', 'nevent'],
			['web', 'https://example.com/generic/<bech32>']
		]);
		expect(resolveHandlerLink(event, nevent)?.href).toBe(
			`https://example.com/generic/${nevent}`
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
		expect(resolveHandlerLink(event, nevent)?.href).toBe('https://example.com/');
	});

	it('returns undefined when there is neither a web handler nor a website', () => {
		expect(resolveHandlerLink(handler([]), nevent)).toBeUndefined();
		expect(resolveHandlerLink(handler([], '{"name":"Foo"}'), nevent)).toBeUndefined();
	});
});

describe('applyHandlerUrlTemplate', () => {
	it('replaces <bech32> with the entity', () => {
		expect(
			applyHandlerUrlTemplate('https://example.com/<bech32>?q=<bech32>', nevent)?.href
		).toBe(`https://example.com/${nevent}?q=${nevent}`);
	});

	it('rejects a template without <bech32> or with a non-HTTP(S) URL', () => {
		expect(applyHandlerUrlTemplate('https://example.com/', nevent)).toBeUndefined();
		expect(applyHandlerUrlTemplate('nostr:<bech32>', nevent)).toBeUndefined();
		expect(applyHandlerUrlTemplate('<bech32>', nevent)).toBeUndefined();
	});
});

describe('parseHandlerWebsite', () => {
	it('parses an HTTP(S) website', () => {
		expect(parseHandlerWebsite('{"website":"http://example.com"}')?.href).toBe(
			'http://example.com/'
		);
	});

	it('rejects an invalid website or content', () => {
		expect(parseHandlerWebsite('{"website":"javascript:alert(1)"}')).toBeUndefined();
		expect(parseHandlerWebsite('{"website":"example.com"}')).toBeUndefined();
		expect(parseHandlerWebsite('{"website":1}')).toBeUndefined();
		expect(parseHandlerWebsite('null')).toBeUndefined();
		expect(parseHandlerWebsite('invalid')).toBeUndefined();
		expect(parseHandlerWebsite('')).toBeUndefined();
	});
});
