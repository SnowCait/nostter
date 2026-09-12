import { describe, expect, it } from 'vitest';
import { getZapSenderPubkey } from './nip57';

const zapSenderPubkey = 'a'.repeat(64);

describe('getZapSenderPubkey', () => {
	it('valid P tag takes precedence over description pubkey', () => {
		expect(
			getZapSenderPubkey({
				pubkey: 'wallet',
				kind: 9735,
				content: '',
				tags: [
					['p', 'author'],
					['P', zapSenderPubkey],
					['description', JSON.stringify({ pubkey: 'description-zapper' })]
				],
				created_at: 0,
				id: '',
				sig: ''
			})
		).toBe(zapSenderPubkey);
	});
	it('invalid P tag falls back to description pubkey', () => {
		expect(
			getZapSenderPubkey({
				pubkey: 'wallet',
				kind: 9735,
				content: '',
				tags: [
					['P', 'invalid'],
					['description', JSON.stringify({ pubkey: 'zapper' })]
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
