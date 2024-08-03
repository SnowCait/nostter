import { describe, expect, it } from 'vitest';
import { getZapperPubkey } from './EventHelper';

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
