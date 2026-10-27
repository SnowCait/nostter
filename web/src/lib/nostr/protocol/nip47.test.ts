import { describe, expect, it } from 'vitest';
import { parsePayInvoiceResponse } from './nip47';

const success = {
	result_type: 'pay_invoice',
	error: null,
	result: { preimage: 'a'.repeat(64) }
};

describe('NIP-47 pay_invoice responses', () => {
	it('accepts an explicit null error and a payment preimage', () => {
		expect(parsePayInvoiceResponse(success)).toEqual({ status: 'success' });
	});

	it('returns the wallet error message without requiring a result', () => {
		expect(
			parsePayInvoiceResponse({
				result_type: 'pay_invoice',
				error: { code: 'PAYMENT_FAILED', message: 'No route found' }
			})
		).toEqual({ status: 'failed', message: 'No route found' });
	});

	it.each([
		null,
		[],
		{},
		{ ...success, result_type: 'get_balance' },
		{ result_type: 'pay_invoice', result: success.result },
		{ ...success, error: false },
		{ ...success, error: {} },
		{ ...success, result: null },
		{ ...success, result: {} },
		{ ...success, result: { preimage: 'invalid' } }
	])('does not infer success or nonpayment from malformed response %j', (value) => {
		expect(parsePayInvoiceResponse(value)).toEqual({
			status: 'unknown',
			reason: 'invalid-response'
		});
	});
});
