import { describe, expect, it } from 'vitest';
import { getZapSenderPubkey } from './nip57';

describe('getZapSenderPubkey', () => {
	it('P tag', () => {
		expect(
			getZapSenderPubkey({
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
			getZapSenderPubkey({
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
			getZapSenderPubkey({
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
			getZapSenderPubkey({
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
