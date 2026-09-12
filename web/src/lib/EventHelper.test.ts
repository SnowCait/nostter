import { describe, expect, it } from 'vitest';
import { aTagContent, isLegacyEncryption, parseAddress } from './EventHelper';
import { generateSecretKey, getPublicKey, nip04, nip44 } from 'nostr-tools';

describe('aTagContent', () => {
	it('distinguishes normal replaceable and addressable coordinates', () => {
		const base = { pubkey: 'pubkey', content: '', created_at: 0, id: '', sig: '' };
		expect(aTagContent({ ...base, kind: 10003, tags: [['d', 'ignored']] })).toBe(
			'10003:pubkey:'
		);
		expect(aTagContent({ ...base, kind: 30001, tags: [['d', 'bookmark']] })).toBe(
			'30001:pubkey:bookmark'
		);
	});
});

describe('isLegacyEncryption', () => {
	const seckey = generateSecretKey();
	const pubkey = getPublicKey(seckey);
	it('legacy', () => {
		const nip04Content = nip04.encrypt(seckey, pubkey, 'content');
		expect(isLegacyEncryption(nip04Content)).toBe(true);
	});
	it('not legacy', () => {
		const conversationKey = nip44.getConversationKey(seckey, pubkey);
		const nip44Content = nip44.encrypt('content', conversationKey);
		expect(isLegacyEncryption(nip44Content)).toBe(false);
	});
});

describe('parseAddress', () => {
	const seckey = generateSecretKey();
	const pubkey = getPublicKey(seckey);
	it('valid address', () => {
		expect(parseAddress(`123:${pubkey}:identifier`)).toEqual([123, pubkey, 'identifier']);
	});
	it('valid address without identifier', () => {
		expect(parseAddress(`123:${pubkey}`)).toEqual([123, pubkey, '']);
	});
	it('valid address with empty identifier', () => {
		expect(parseAddress(`123:${pubkey}:`)).toEqual([123, pubkey, '']);
	});
	it('valid address with : in identifier', () => {
		expect(parseAddress(`123:${pubkey}:iden:tifier`)).toEqual([123, pubkey, 'iden:tifier']);
	});
	it('invalid address with non-numeric kind', () => {
		expect(parseAddress(`abc:${pubkey}:identifier`)).toBeUndefined();
	});
	it('invalid address with missing pubkey', () => {
		expect(parseAddress('123')).toBeUndefined();
	});
	it('invalid address with empty string', () => {
		expect(parseAddress('')).toBeUndefined();
	});
	it('invalid address with non-hex pubkey', () => {
		expect(parseAddress('123:nonhex:identifier')).toBeUndefined();
	});
});
