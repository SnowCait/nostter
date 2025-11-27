import { describe, expect, it } from 'vitest';
import { getZapperPubkey, referTags } from './EventHelper';

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
