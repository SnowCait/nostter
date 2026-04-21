import { describe, expect, it } from 'vitest';
import { getZapperPubkey, isLegacyEncryption, parseAddress, referTags } from './EventHelper';
import { generateSecretKey, getPublicKey, nip04, nip44 } from 'nostr-tools';

describe('referTags', () => {
	it('root', () => {
		const { root, reply } = referTags({
			kind: 1,
			pubkey: '',
			content: '',
			tags: [['e', 'root-id', '', 'root']],
			created_at: 0,
			id: '',
			sig: ''
		});
		expect(root?.at(1)).toBe('root-id');
		expect(reply?.at(1)).toBe(undefined);
	});
	it('reply', () => {
		const { root, reply } = referTags({
			kind: 1,
			pubkey: '',
			content: '',
			tags: [
				['e', 'root-id', '', 'root'],
				['e', 'reply-id', '', 'reply']
			],
			created_at: 0,
			id: '',
			sig: ''
		});
		expect(root?.at(1)).toBe('root-id');
		expect(reply?.at(1)).toBe('reply-id');
	});
	it('mention', () => {
		const { root, reply } = referTags({
			kind: 1,
			pubkey: '',
			content: '',
			tags: [['e', 'mention-id', '', 'mention']],
			created_at: 0,
			id: '',
			sig: ''
		});
		expect(root?.at(1)).toBe(undefined);
		expect(reply?.at(1)).toBe(undefined);
	});
	it('deprecated', () => {
		const { root, reply } = referTags({
			kind: 1,
			pubkey: '',
			content: '',
			tags: [
				['e', 'root-id'],
				['e', 'reply-id']
			],
			created_at: 0,
			id: '',
			sig: ''
		});
		expect(root?.at(1)).toBe('root-id');
		expect(reply?.at(1)).toBe('reply-id');
	});
	it('mixed', () => {
		const { root, reply } = referTags({
			kind: 1,
			pubkey: '',
			content: '',
			tags: [
				['e', 'root-id', '', 'root'],
				['e', 'reply-id']
			],
			created_at: 0,
			id: '',
			sig: ''
		});
		expect(root?.at(1)).toBe('root-id');
		expect(reply?.at(1)).toBe('reply-id');
	});
	it('mixed with last root', () => {
		const { root, reply } = referTags({
			kind: 1,
			pubkey: '',
			content: '',
			tags: [
				['e', 'reply-id'],
				['e', 'root-id', '', 'root']
			],
			created_at: 0,
			id: '',
			sig: ''
		});
		expect(root?.at(1)).toBe('root-id');
		expect(reply?.at(1)).toBe('reply-id');
	});
	it('mixed with first reply', () => {
		const { root, reply } = referTags({
			kind: 1,
			pubkey: '',
			content: '',
			tags: [
				['e', 'reply-id', '', 'reply'],
				['e', 'root-id']
			],
			created_at: 0,
			id: '',
			sig: ''
		});
		expect(root?.at(1)).toBe('root-id');
		expect(reply?.at(1)).toBe('reply-id');
	});
	it('invalid reply', () => {
		const { root, reply } = referTags({
			kind: 1,
			pubkey: '',
			content: '',
			tags: [['e', 'root-id', '', 'reply']],
			created_at: 0,
			id: '',
			sig: ''
		});
		expect(root?.at(1)).toBe('root-id');
		expect(reply?.at(1)).toBe(undefined);
	});
	it('invalid duplicate marker', () => {
		const { root, reply } = referTags({
			kind: 1,
			pubkey: '',
			content: '',
			tags: [
				['e', 'root-id-1st', '', 'root'],
				['e', 'root-id-2nd', '', 'root'],
				['e', 'reply-id-1st', '', 'reply'],
				['e', 'reply-id-2nd', '', 'reply']
			],
			created_at: 0,
			id: '',
			sig: ''
		});
		expect(root?.at(1)).toBe('root-id-2nd');
		expect(reply?.at(1)).toBe('reply-id-2nd');
	});
});

describe('getZapperPubkey', () => {
	it('P tag', () => {
		expect(
			getZapperPubkey({
				pubkey: 'wallet',
				kind: 9735,
				content: '',
				tags: [
					['p', 'author'],
					['P', 'zapper']
				],
				created_at: 0,
				id: '',
				sig: ''
			})
		).toBe('zapper');
	});
	it('description pubkey', () => {
		expect(
			getZapperPubkey({
				pubkey: 'wallet',
				kind: 9735,
				content: '',
				tags: [
					['p', 'author'],
					['description', JSON.stringify({ pubkey: 'zapper' })]
				],
				created_at: 0,
				id: '',
				sig: ''
			})
		).toBe('zapper');
	});
	it('none', () => {
		expect(
			getZapperPubkey({
				pubkey: 'wallet',
				kind: 9735,
				content: '',
				tags: [['p', 'author']],
				created_at: 0,
				id: '',
				sig: ''
			})
		).toBe(undefined);
		expect(
			getZapperPubkey({
				pubkey: 'wallet',
				kind: 1,
				content: '',
				tags: [['p', 'author']],
				created_at: 0,
				id: '',
				sig: ''
			})
		).toBe(undefined);
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
