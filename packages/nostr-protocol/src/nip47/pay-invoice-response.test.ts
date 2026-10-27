import { describe, expect, it } from 'vitest';
import { parsePayInvoiceResponse } from './pay-invoice-response.js';

function json(value: unknown): string {
	return JSON.stringify(value) || '';
}

describe('parsePayInvoiceResponse', () => {
	it('accepts the NIP-47 successful pay_invoice response', () => {
		expect(
			parsePayInvoiceResponse(
				json({
					result_type: 'pay_invoice',
					error: null,
					result: { preimage: 'a'.repeat(64) }
				})
			)
		).toEqual({ status: 'success' });
	});

	it('accepts a noncompliant success response without error for compatibility with the NIP-47 example', () => {
		expect(
			parsePayInvoiceResponse(
				json({
					result_type: 'pay_invoice',
					result: { preimage: 'a'.repeat(64) }
				})
			)
		).toEqual({ status: 'success' });
	});

	it('returns a valid NIP-47 payment error message', () => {
		expect(
			parsePayInvoiceResponse(
				json({
					result_type: 'pay_invoice',
					error: { code: 'PAYMENT_FAILED', message: 'Payment failed' },
					result: null
				})
			)
		).toEqual({ status: 'failed', message: 'Payment failed' });
	});

	it('accepts a noncompliant error response without result for compatibility', () => {
		// Some wallets omit result from errors even though NIP-47 shows result: null.
		expect(
			parsePayInvoiceResponse(
				json({
					result_type: 'pay_invoice',
					error: { code: 'PAYMENT_FAILED', message: 'Payment failed' }
				})
			)
		).toEqual({ status: 'failed', message: 'Payment failed' });
	});

	it('returns invalid for malformed JSON', () => {
		expect(parsePayInvoiceResponse('{invalid json')).toEqual({ status: 'invalid' });
	});

	it('rejects a success response without error when the preimage is invalid', () => {
		expect(
			parsePayInvoiceResponse(
				json({ result_type: 'pay_invoice', result: { preimage: 'not-hex' } })
			)
		).toEqual({ status: 'invalid' });
	});

	it('rejects a noncompliant response without error or result', () => {
		expect(parsePayInvoiceResponse(json({ result_type: 'pay_invoice' }))).toEqual({
			status: 'invalid'
		});
	});

	it.each([
		null,
		[],
		{},
		{ result_type: 'get_balance', error: null, result: { preimage: 'a'.repeat(64) } },
		{ result_type: 'pay_invoice', error: false, result: { preimage: 'a'.repeat(64) } },
		{ result_type: 'pay_invoice', error: null, result: null },
		{ result_type: 'pay_invoice', error: null, result: {} },
		{ result_type: 'pay_invoice', error: null, result: { preimage: 'not-hex' } },
		{ result_type: 'pay_invoice', error: { code: '', message: 'Failed' } },
		{ result_type: 'pay_invoice', error: { code: 'FAILED', message: '' } }
	])('rejects malformed response %j', (value) => {
		expect(parsePayInvoiceResponse(json(value))).toEqual({ status: 'invalid' });
	});
});
