import { describe, expect, it } from 'vitest';
import type { Event } from 'nostr-tools';
import { buildZapInvoiceUrl } from './invoice-url.js';

const zapRequestEvent: Event = {
	kind: 9734,
	pubkey: 'a'.repeat(64),
	created_at: 1,
	tags: [
		['p', 'b'.repeat(64)],
		['amount', '21000']
	],
	content: 'a & b = c ? # + % / 日本語',
	id: 'c'.repeat(64),
	sig: 'd'.repeat(128)
};

describe('buildZapInvoiceUrl', () => {
	it.each([
		['https://example.com/invoice', []],
		[
			'https://example.com/invoice?foo=bar&foo=baz',
			[
				['foo', 'bar'],
				['foo', 'baz']
			]
		],
		[
			'https://example.com/invoice?value=a%20b%2Bc%26d&tilde=%7e',
			[
				['value', 'a b+c&d'],
				['tilde', '~']
			]
		],
		[
			'https://example.com/invoice?amount=9&nostr=old&foo=bar&amount=10&nostr=older',
			[['foo', 'bar']]
		]
	] as const)('builds an invoice URL from %s', (callback, existing) => {
		const url = buildZapInvoiceUrl(callback, 21000, zapRequestEvent);
		expect(url.origin + url.pathname).toBe('https://example.com/invoice');
		expect(url.searchParams.getAll('amount')).toEqual(['21000']);
		expect(url.searchParams.getAll('nostr')).toEqual([JSON.stringify(zapRequestEvent)]);
		const retained = [...url.searchParams].filter(
			([key]) => key !== 'amount' && key !== 'nostr'
		);
		expect(retained).toEqual(existing);
	});

	it('does not modify the original callback URL', () => {
		const callback = new URL('https://example.com/invoice?foo=a%20b&amount=9&nostr=old');
		const original = callback.href;
		const url = buildZapInvoiceUrl(callback, 21000, zapRequestEvent);
		expect(url).not.toBe(callback);
		expect(callback.href).toBe(original);
	});
});
