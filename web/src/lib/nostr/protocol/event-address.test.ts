import { describe, expect, it } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { getEventAddress, findIdentifier, parseEventAddress } from './event-address';

describe('findIdentifier', () => {
	it('returns the value of a d tag', () => {
		expect(findIdentifier([['d', 'identifier']])).toBe('identifier');
	});

	it('returns undefined when there is no d tag', () => {
		expect(findIdentifier([])).toBe(undefined);
		expect(findIdentifier([['t', 'identifier']])).toBe(undefined);
	});

	it('preserves an empty d value', () => {
		expect(findIdentifier([['d', '']])).toBe('');
	});

	it('returns an empty string for a d tag without a value', () => {
		expect(findIdentifier([['d']])).toBe('');
	});

	it('returns the first d tag when there are multiple', () => {
		expect(
			findIdentifier([
				['d', 'first'],
				['d', 'second']
			])
		).toBe('first');
	});
});

describe('getEventAddress', () => {
	it('distinguishes normal replaceable and addressable coordinates', () => {
		const base = { pubkey: 'pubkey', content: '', created_at: 0, id: '', sig: '' };
		expect(getEventAddress({ ...base, kind: 10003, tags: [['d', 'ignored']] })).toBe(
			'10003:pubkey:'
		);
		expect(getEventAddress({ ...base, kind: 30001, tags: [['d', 'bookmark']] })).toBe(
			'30001:pubkey:bookmark'
		);
	});

	it('uses an empty identifier for an addressable kind without a d tag', () => {
		const base = { pubkey: 'pubkey', content: '', created_at: 0, id: '', sig: '' };
		expect(getEventAddress({ ...base, kind: 30001, tags: [] })).toBe('30001:pubkey:');
	});
});

describe('parseEventAddress', () => {
	const seckey = generateSecretKey();
	const pubkey = getPublicKey(seckey);
	it('valid address', () => {
		expect(parseEventAddress(`123:${pubkey}:identifier`)).toEqual({
			kind: 123,
			pubkey,
			identifier: 'identifier'
		});
	});
	it('valid address without identifier', () => {
		expect(parseEventAddress(`123:${pubkey}`)).toEqual({
			kind: 123,
			pubkey,
			identifier: ''
		});
	});
	it('valid address with empty identifier', () => {
		expect(parseEventAddress(`123:${pubkey}:`)).toEqual({
			kind: 123,
			pubkey,
			identifier: ''
		});
	});
	it('valid address with : in identifier', () => {
		expect(parseEventAddress(`123:${pubkey}:iden:tifier`)).toEqual({
			kind: 123,
			pubkey,
			identifier: 'iden:tifier'
		});
	});
	it('invalid address with non-numeric kind', () => {
		expect(parseEventAddress(`abc:${pubkey}:identifier`)).toBeUndefined();
	});
	it('invalid address with missing pubkey', () => {
		expect(parseEventAddress('123')).toBeUndefined();
	});
	it('invalid address with empty string', () => {
		expect(parseEventAddress('')).toBeUndefined();
	});
	it('invalid address with non-hex pubkey', () => {
		expect(parseEventAddress('123:nonhex:identifier')).toBeUndefined();
	});
});
