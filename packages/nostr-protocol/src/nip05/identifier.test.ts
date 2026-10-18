import { describe, expect, it } from 'vitest';
import { buildNip05QueryUrl, parseNip05Identifier } from './identifier.js';

describe('parseNip05Identifier', () => {
	it.each([
		['alice@example.com', 'alice', 'example.com'],
		['Alice@Example.com', 'Alice', 'Example.com'],
		['_@Example.com', '_', 'Example.com'],
		['Example.com', '_', 'Example.com']
	])('parses %s without changing its casing', (value, localPart, domain) => {
		expect(parseNip05Identifier(value)).toEqual({ localPart, domain });
	});

	it('returns undefined for an unparseable identifier', () => {
		expect(parseNip05Identifier('not an address')).toBeUndefined();
	});
});

describe('buildNip05QueryUrl', () => {
	it('builds the HTTPS query URL while preserving local-part casing', () => {
		expect(buildNip05QueryUrl({ localPart: 'Alice', domain: 'Example.com' })).toBe(
			'https://example.com/.well-known/nostr.json?name=Alice'
		);
	});

	it('encodes the local-part so a plus sign is not interpreted as a space', () => {
		expect(buildNip05QueryUrl({ localPart: 'alice+tag', domain: 'example.com' })).toBe(
			'https://example.com/.well-known/nostr.json?name=alice%2Btag'
		);
	});
});
