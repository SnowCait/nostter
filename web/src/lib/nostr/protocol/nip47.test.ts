import { describe, expect, it } from 'vitest';
import { parsePayInvoiceResponse } from './nip47';

describe('parsePayInvoiceResponse', () => {
	it('accepts the NIP-47 successful pay_invoice response', () => {
		expect(
			parsePayInvoiceResponse({
				result_type: 'pay_invoice',
				error: null,
				result: { preimage: 'a'.repeat(64) }
			})
		).toEqual({ status: 'success' });
	});

	it('returns a valid NIP-47 payment error message', () => {
		expect(
			parsePayInvoiceResponse({
				result_type: 'pay_invoice',
				error: { code: 'PAYMENT_FAILED', message: 'Payment failed' },
				result: null
			})
		).toEqual({ status: 'failed', message: 'Payment failed' });
	});

	it.each([
		undefined,
		null,
		[],
		{},
		{ result_type: 'get_balance', error: null, result: { preimage: 'a'.repeat(64) } },
		{ result_type: 'pay_invoice', result: { preimage: 'a'.repeat(64) } },
		{ result_type: 'pay_invoice', error: false, result: { preimage: 'a'.repeat(64) } },
		{ result_type: 'pay_invoice', error: null, result: null },
		{ result_type: 'pay_invoice', error: null, result: {} },
		{ result_type: 'pay_invoice', error: null, result: { preimage: 'not-hex' } },
		{ result_type: 'pay_invoice', error: { code: '', message: 'Failed' } },
		{ result_type: 'pay_invoice', error: { code: 'FAILED', message: '' } }
	])('rejects malformed response %j', (response) => {
		expect(parsePayInvoiceResponse(response)).toEqual({ status: 'invalid' });
	});
});
